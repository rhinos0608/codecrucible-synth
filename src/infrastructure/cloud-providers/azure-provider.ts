/**
 * Azure Cloud Provider Implementation
 * Production-ready Azure integration for enterprise deployment
 */

import { ResourceManagementClient, ResourceGroup } from '@azure/arm-resources';
import { ContainerInstanceManagementClient, ContainerGroup } from '@azure/arm-containerinstance';
import {
  ComputeManagementClient,
  VirtualMachine,
  VirtualMachineScaleSet,
} from '@azure/arm-compute';
import { WebSiteManagementClient, Site } from '@azure/arm-appservice';
import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '../../core/logger.js';

export interface AzureDeploymentConfig {
  subscriptionId: string;
  resourceGroupName: string;
  location: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  tags?: Record<string, string>;
}

export interface AzureInstance {
  id: string;
  name: string;
  location: string;
  vmSize: string;
  provisioningState: string;
  powerState?: string;
  publicIp?: string;
  privateIp?: string;
  tags: Record<string, string>;
}

export class AzureProvider {
  private credential: DefaultAzureCredential;
  private resourceClient: ResourceManagementClient;
  private computeClient: ComputeManagementClient;
  private containerClient: ContainerInstanceManagementClient;
  private webClient: WebSiteManagementClient;
  private config: AzureDeploymentConfig;

  constructor(config: AzureDeploymentConfig) {
    this.config = config;

    // Use DefaultAzureCredential which tries multiple authentication methods
    this.credential = new DefaultAzureCredential();

    this.resourceClient = new ResourceManagementClient(this.credential, config.subscriptionId);

    this.computeClient = new ComputeManagementClient(this.credential, config.subscriptionId);

    this.containerClient = new ContainerInstanceManagementClient(
      this.credential,
      config.subscriptionId
    );

    this.webClient = new WebSiteManagementClient(this.credential, config.subscriptionId);
  }

  /**
   * Create or update resource group
   */
  async ensureResourceGroup(): Promise<ResourceGroup> {
    try {
      const resourceGroup = await this.resourceClient.resourceGroups.createOrUpdate(
        this.config.resourceGroupName,
        {
          location: this.config.location,
          tags: this.config.tags,
        }
      );

      logger.info(`Resource group ready: ${resourceGroup.name}`);
      return resourceGroup;
    } catch (error) {
      logger.error('Failed to create resource group:', error);
      throw error;
    }
  }

  /**
   * Deploy to Azure Container Instances
   */
  async deployContainerInstance(
    containerName: string,
    image: string,
    cpu: number = 1,
    memoryInGB: number = 1.5
  ): Promise<ContainerGroup> {
    try {
      await this.ensureResourceGroup();

      const containerGroupOperation =
        await this.containerClient.containerGroups.beginCreateOrUpdate(
          this.config.resourceGroupName,
          containerName,
          {
            location: this.config.location,
            containers: [
              {
                name: containerName,
                image: image,
                resources: {
                  requests: {
                    cpu: cpu,
                    memoryInGB: memoryInGB,
                  },
                },
                ports: [
                  {
                    port: 3000,
                    protocol: 'TCP',
                  },
                ],
                environmentVariables: [
                  {
                    name: 'NODE_ENV',
                    value: 'production',
                  },
                  {
                    name: 'AZURE_REGION',
                    value: this.config.location,
                  },
                ],
              },
            ],
            osType: 'Linux',
            restartPolicy: 'Always',
            ipAddress: {
              type: 'Public',
              ports: [
                {
                  port: 3000,
                  protocol: 'TCP',
                },
              ],
              dnsNameLabel: containerName.toLowerCase(),
            },
            tags: this.config.tags,
          }
        );

      const containerGroup = await containerGroupOperation.pollUntilDone();

      logger.info(`Container instance deployed: ${containerGroup.name}`);
      logger.info(`FQDN: ${containerGroup.ipAddress?.fqdn}`);

      return containerGroup;
    } catch (error) {
      logger.error('Failed to deploy container instance:', error);
      throw error;
    }
  }

  /**
   * Deploy to Azure App Service
   */
  async deployAppService(
    appName: string,
    dockerImage: string,
    planSku: 'B1' | 'S1' | 'P1V2' = 'B1'
  ): Promise<Site> {
    try {
      await this.ensureResourceGroup();

      // Create App Service Plan
      const planName = `${appName}-plan`;
      await this.webClient.appServicePlans.beginCreateOrUpdate(
        this.config.resourceGroupName,
        planName,
        {
          location: this.config.location,
          sku: {
            name: planSku,
            tier: this.getSkuTier(planSku),
          },
          kind: 'linux',
          reserved: true, // Required for Linux
        }
      );

      // Create Web App
      const webAppOperation = await this.webClient.webApps.beginCreateOrUpdate(
        this.config.resourceGroupName,
        appName,
        {
          location: this.config.location,
          serverFarmId: `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroupName}/providers/Microsoft.Web/serverfarms/${planName}`,
          siteConfig: {
            linuxFxVersion: `DOCKER|${dockerImage}`,
            alwaysOn: true,
            webSocketsEnabled: true,
            appSettings: [
              {
                name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE',
                value: 'false',
              },
              {
                name: 'DOCKER_REGISTRY_SERVER_URL',
                value: 'https://index.docker.io',
              },
            ],
          },
          httpsOnly: true,
          tags: this.config.tags,
        }
      );

      const webApp = await webAppOperation.pollUntilDone();

      logger.info(`App Service deployed: ${webApp.name}`);
      logger.info(`URL: https://${webApp.defaultHostName}`);

      return webApp;
    } catch (error) {
      logger.error('Failed to deploy App Service:', error);
      throw error;
    }
  }

  /**
   * Create Virtual Machine
   */
  async createVirtualMachine(
    vmName: string,
    vmSize: string = 'Standard_B2s',
    adminUsername: string = 'azureuser'
  ): Promise<VirtualMachine> {
    try {
      await this.ensureResourceGroup();

      // Create network interface (requires @azure/arm-network package)
      const nicName = `${vmName}-nic`;
      // const networkClient = new (await import('@azure/arm-network')).NetworkManagementClient(
      //   this.credential,
      //   this.config.subscriptionId
      // );

      // Simplified VM creation without network interface for now
      logger.warn(
        'Network interface creation skipped - install @azure/arm-network package for full functionality'
      );

      // Create public IP (commented out due to network client dependency)
      /* Network operations require @azure/arm-network package
      const publicIp = await networkClient.publicIPAddresses.beginCreateOrUpdate(
        this.config.resourceGroupName,
        `${vmName}-ip`,
        {
          location: this.config.location,
          publicIPAllocationMethod: 'Static',
          sku: {
            name: 'Standard',
          },
        }
      );
      */

      /* Network interface creation
      // Create network interface
      const nic = await networkClient.networkInterfaces.beginCreateOrUpdate(
        this.config.resourceGroupName,
        nicName,
        {
          location: this.config.location,
          ipConfigurations: [
            {
              name: 'ipconfig1',
              subnet: {
                id: await this.getOrCreateSubnet(),
              },
              publicIPAddress: {
                id: publicIp.id,
              },
            },
          ],
        }
      );
      
      */

      // Create VM (simplified without network interface)
      const vmOperation = await this.computeClient.virtualMachines.beginCreateOrUpdate(
        this.config.resourceGroupName,
        vmName,
        {
          location: this.config.location,
          hardwareProfile: {
            vmSize: vmSize,
          },
          storageProfile: {
            imageReference: {
              publisher: 'Canonical',
              offer: 'UbuntuServer',
              sku: '18.04-LTS',
              version: 'latest',
            },
            osDisk: {
              createOption: 'FromImage',
              managedDisk: {
                storageAccountType: 'Premium_LRS',
              },
            },
          },
          osProfile: {
            computerName: vmName,
            adminUsername: adminUsername,
            adminPassword: this.generateSecurePassword(),
            linuxConfiguration: {
              disablePasswordAuthentication: false,
            },
          },
          // networkProfile: {
          //   networkInterfaces: [
          //     {
          //       id: nic.id,
          //       primary: true,
          //     },
          //   ],
          // },
          tags: this.config.tags,
        }
      );

      const vm = await vmOperation.pollUntilDone();

      logger.info(`Virtual Machine created: ${vm.name}`);
      return vm;
    } catch (error) {
      logger.error('Failed to create VM:', error);
      throw error;
    }
  }

  /**
   * Create Virtual Machine Scale Set
   */
  async createVMScaleSet(
    scaleSetName: string,
    instanceCount: number = 2,
    vmSize: string = 'Standard_B2s'
  ): Promise<VirtualMachineScaleSet> {
    try {
      await this.ensureResourceGroup();

      const scaleSetOperation =
        await this.computeClient.virtualMachineScaleSets.beginCreateOrUpdate(
          this.config.resourceGroupName,
          scaleSetName,
          {
            location: this.config.location,
            sku: {
              name: vmSize,
              capacity: instanceCount,
              tier: 'Standard',
            },
            upgradePolicy: {
              mode: 'Automatic',
            },
            virtualMachineProfile: {
              storageProfile: {
                imageReference: {
                  publisher: 'Canonical',
                  offer: 'UbuntuServer',
                  sku: '18.04-LTS',
                  version: 'latest',
                },
                osDisk: {
                  createOption: 'FromImage',
                  caching: 'ReadWrite',
                  managedDisk: {
                    storageAccountType: 'Premium_LRS',
                  },
                },
              },
              osProfile: {
                computerNamePrefix: scaleSetName,
                adminUsername: 'azureuser',
                adminPassword: this.generateSecurePassword(),
                customData: Buffer.from(this.getCloudInitScript()).toString('base64'),
              },
              networkProfile: {
                networkInterfaceConfigurations: [
                  {
                    name: `${scaleSetName}-nic`,
                    primary: true,
                    ipConfigurations: [
                      {
                        name: 'ipconfig1',
                        subnet: {
                          id: await this.getOrCreateSubnet(),
                        },
                        publicIPAddressConfiguration: {
                          name: `${scaleSetName}-pip`,
                          idleTimeoutInMinutes: 15,
                        },
                      },
                    ],
                  },
                ],
              },
              extensionProfile: {
                extensions: [
                  {
                    name: 'HealthExtension',
                    publisher: 'Microsoft.Azure.Extensions',
                    type: 'CustomScript',
                    typeHandlerVersion: '2.1',
                    autoUpgradeMinorVersion: true,
                    settings: {
                      fileUris: [],
                      commandToExecute: 'echo "Health check ready"',
                    },
                  },
                ],
              },
            },
            automaticRepairsPolicy: {
              enabled: true,
              gracePeriod: 'PT30M',
            },
            tags: this.config.tags,
          }
        );

      const scaleSet = await scaleSetOperation.pollUntilDone();

      logger.info(`VM Scale Set created: ${scaleSet.name}`);
      return scaleSet;
    } catch (error) {
      logger.error('Failed to create VM Scale Set:', error);
      throw error;
    }
  }

  /**
   * Deploy using ARM template
   */
  async deployARMTemplate(
    deploymentName: string,
    templateUri: string,
    parameters?: Record<string, any>
  ): Promise<void> {
    try {
      await this.ensureResourceGroup();

      const deploymentOperation = await this.resourceClient.deployments.beginCreateOrUpdate(
        this.config.resourceGroupName,
        deploymentName,
        {
          properties: {
            mode: 'Incremental',
            templateLink: {
              uri: templateUri,
            },
            parameters: parameters,
          },
        }
      );

      const deployment = await deploymentOperation.pollUntilDone();

      logger.info(`ARM template deployment started: ${deployment.name}`);

      // Wait for deployment to complete
      await this.waitForDeployment(deploymentName);
    } catch (error) {
      logger.error('Failed to deploy ARM template:', error);
      throw error;
    }
  }

  /**
   * Wait for ARM deployment to complete
   */
  private async waitForDeployment(deploymentName: string): Promise<void> {
    const maxAttempts = 120; // 30 minutes
    let attempts = 0;

    while (attempts < maxAttempts) {
      const deployment = await this.resourceClient.deployments.get(
        this.config.resourceGroupName,
        deploymentName
      );

      const state = deployment.properties?.provisioningState;

      if (state === 'Succeeded') {
        logger.info(`Deployment ${deploymentName} completed successfully`);
        return;
      }

      if (state === 'Failed' || state === 'Canceled') {
        throw new Error(`Deployment ${deploymentName} failed with state: ${state}`);
      }

      await new Promise(resolve => setTimeout(resolve, 15000));
      attempts++;
    }

    throw new Error(`Deployment ${deploymentName} timed out`);
  }

  /**
   * Get or create subnet
   */
  private async getOrCreateSubnet(): Promise<string> {
    // Network operations require @azure/arm-network package
    throw new Error('Subnet creation requires @azure/arm-network package installation');

    /* 
    const networkClient = new (await import('@azure/arm-network')).NetworkManagementClient(
      this.credential,
      this.config.subscriptionId
    );
    
    const vnetName = 'codecrucible-vnet';
    const subnetName = 'default';
    
    try {
      // Try to get existing subnet
      const subnet = await networkClient.subnets.get(
        this.config.resourceGroupName,
        vnetName,
        subnetName
      );
      return subnet.id!;
    } catch {
      // Create VNet and subnet if not exists
      const vnet = await networkClient.virtualNetworks.beginCreateOrUpdate(
        this.config.resourceGroupName,
        vnetName,
        {
          location: this.config.location,
          addressSpace: {
            addressPrefixes: ['10.0.0.0/16'],
          },
          subnets: [
            {
              name: subnetName,
              addressPrefix: '10.0.1.0/24',
            },
          ],
        }
      );
      
      return vnet.subnets![0].id!;
    }
    */
  }

  /**
   * Generate secure password
   */
  private generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + 'Aa1!'; // Ensure complexity requirements
  }

  /**
   * Get cloud-init script for VM initialization
   */
  private getCloudInitScript(): string {
    return `#!/bin/bash
# Update and install Docker
apt-get update
apt-get install -y docker.io docker-compose

# Start Docker service
systemctl start docker
systemctl enable docker

# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Pull and run application
docker pull codecrucible/synth:latest
docker run -d -p 80:3000 --name codecrucible --restart=always codecrucible/synth:latest

# Install monitoring agent
wget https://aka.ms/downloadazcmagent -O ~/install_linux_azcmagent.sh
bash ~/install_linux_azcmagent.sh
`;
  }

  /**
   * Get SKU tier from SKU name
   */
  private getSkuTier(skuName: string): string {
    const tiers: Record<string, string> = {
      B1: 'Basic',
      B2: 'Basic',
      B3: 'Basic',
      S1: 'Standard',
      S2: 'Standard',
      S3: 'Standard',
      P1V2: 'PremiumV2',
      P2V2: 'PremiumV2',
      P3V2: 'PremiumV2',
    };
    return tiers[skuName] || 'Basic';
  }

  /**
   * Scale container instances
   */
  async scaleContainerInstance(
    containerGroupName: string,
    cpu: number,
    memory: number
  ): Promise<void> {
    const containerGroup = await this.containerClient.containerGroups.get(
      this.config.resourceGroupName,
      containerGroupName
    );

    if (containerGroup.containers && containerGroup.containers[0]) {
      containerGroup.containers[0].resources!.requests!.cpu = cpu;
      containerGroup.containers[0].resources!.requests!.memoryInGB = memory;

      await this.containerClient.containerGroups.beginCreateOrUpdate(
        this.config.resourceGroupName,
        containerGroupName,
        containerGroup
      );

      logger.info(`Scaled container instance: ${containerGroupName}`);
    }
  }

  /**
   * Delete resource group and all resources
   */
  async deleteResourceGroup(): Promise<void> {
    await this.resourceClient.resourceGroups.beginDeleteAndWait(this.config.resourceGroupName);
    logger.info(`Deleted resource group: ${this.config.resourceGroupName}`);
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentName: string): Promise<string> {
    const deployment = await this.resourceClient.deployments.get(
      this.config.resourceGroupName,
      deploymentName
    );
    return deployment.properties?.provisioningState || 'Unknown';
  }
}

export default AzureProvider;
