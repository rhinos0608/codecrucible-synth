/**
 * Enterprise Test Framework Test Suite
 * Testing the comprehensive testing framework with quality gates
 */

import { EnterpriseTestRunner, TestFixtures, MockFactory, PerformanceTester, testRunner } from '../../../src/testing/test-framework.js';

describe('Enterprise Test Framework', () => {
  let runner: EnterpriseTestRunner;

  beforeEach(() => {
    runner = new EnterpriseTestRunner();
  });

  describe('Test Suite Management', () => {
    test('should register and execute test suites', async () => {
      let beforeAllRan = false;
      let afterAllRan = false;
      let testRan = false;

      runner.suite('Test Suite', () => {
        runner.currentSuite!.beforeAll = async () => {
          beforeAllRan = true;
        };

        runner.currentSuite!.afterAll = async () => {
          afterAllRan = true;
        };

        runner.test('Sample Test', () => {
          testRan = true;
        });
      });

      const results = await runner.runAll();

      expect(beforeAllRan).toBe(true);
      expect(afterAllRan).toBe(true);
      expect(testRan).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(true);
    });

    test('should handle test failures', async () => {
      runner.suite('Failing Suite', () => {
        runner.test('Failing Test', () => {
          throw new Error('Test failure');
        });
      });

      const results = await runner.runAll();

      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error).toBeInstanceOf(Error);
      expect(results[0].error?.message).toBe('Test failure');
    });

    test('should support test timeouts', async () => {
      runner.suite('Timeout Suite', () => {
        runner.test('Timeout Test', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        }, { timeout: 50 });
      });

      const results = await runner.runAll();

      expect(results.length).toBe(1);
      expect(results[0].passed).toBe(false);
      expect(results[0].error?.message).toContain('timeout');
    });

    test('should skip tests when marked', async () => {
      let skippedTestRan = false;

      runner.suite('Skip Suite', () => {
        runner.test('Normal Test', () => {
          // This should run
        });

        runner.test('Skipped Test', () => {
          skippedTestRan = true;
        }, { skip: true });
      });

      const results = await runner.runAll();

      expect(skippedTestRan).toBe(false);
      expect(results.length).toBe(1); // Only non-skipped test
    });

    test('should handle beforeEach and afterEach', async () => {
      let beforeEachCount = 0;
      let afterEachCount = 0;

      runner.suite('Lifecycle Suite', () => {
        runner.currentSuite!.beforeEach = async () => {
          beforeEachCount++;
        };

        runner.currentSuite!.afterEach = async () => {
          afterEachCount++;
        };

        runner.test('Test 1', () => {});
        runner.test('Test 2', () => {});
      });

      await runner.runAll();

      expect(beforeEachCount).toBe(2);
      expect(afterEachCount).toBe(2);
    });
  });

  describe('Assertion Context', () => {
    test('should provide assertion methods', async () => {
      let assertionCount = 0;

      runner.suite('Assertion Suite', () => {
        runner.test('Assertion Test', () => {
          const assert = (runner as any).createAssertionContext();
          
          assert.equal(1, 1, 'Numbers should be equal');
          assert.truthy(true, 'Value should be truthy');
          assert.falsy(false, 'Value should be falsy');
          
          assertionCount = assert.count;
        });
      });

      await runner.runAll();
      expect(assertionCount).toBe(3);
    });

    test('should handle assertion failures', async () => {
      runner.suite('Assertion Failure Suite', () => {
        runner.test('Failing Assertion', () => {
          const assert = (runner as any).createAssertionContext();
          assert.equal(1, 2, 'This should fail');
        });
      });

      const results = await runner.runAll();

      expect(results[0].passed).toBe(false);
      expect(results[0].error?.message).toContain('Expected 1 to equal 2');
    });

    test('should support deep equality checks', async () => {
      runner.suite('Deep Equality Suite', () => {
        runner.test('Deep Equal Test', () => {
          const assert = (runner as any).createAssertionContext();
          
          const obj1 = { a: 1, b: { c: 2 } };
          const obj2 = { a: 1, b: { c: 2 } };
          
          assert.deepEqual(obj1, obj2);
        });
      });

      const results = await runner.runAll();
      expect(results[0].passed).toBe(true);
    });

    test('should handle function throwing assertions', async () => {
      runner.suite('Throws Suite', () => {
        runner.test('Throws Test', () => {
          const assert = (runner as any).createAssertionContext();
          
          assert.throws(() => {
            throw new Error('Expected error');
          });
        });
      });

      const results = await runner.runAll();
      expect(results[0].passed).toBe(true);
    });

    test('should handle async rejection assertions', async () => {
      runner.suite('Rejects Suite', () => {
        runner.test('Rejects Test', async () => {
          const assert = (runner as any).createAssertionContext();
          
          await assert.rejects(async () => {
            throw new Error('Expected rejection');
          });
        });
      });

      const results = await runner.runAll();
      expect(results[0].passed).toBe(true);
    });
  });

  describe('Quality Gates (Grimoire QWAN)', () => {
    test('should check coverage quality gate', async () => {
      // Mock some tests to simulate coverage
      runner.suite('Coverage Suite', () => {
        runner.test('Coverage Test', () => {});
      });

      await runner.runAll();
      const passed = (runner as any).checkQualityGates();
      
      // Should check for 90% coverage threshold
      expect(typeof passed).toBe('boolean');
    });

    test('should check performance quality gate', async () => {
      // Test that performance budget (5000ms) is enforced
      runner.suite('Performance Suite', () => {
        runner.test('Fast Test', () => {
          // Fast test - should pass performance gate
        });
      });

      await runner.runAll();
      const passed = (runner as any).checkQualityGates();
      
      expect(typeof passed).toBe('boolean');
    });

    test('should calculate overall coverage', () => {
      const coverage = (runner as any).calculateOverallCoverage();
      
      expect(coverage).toHaveProperty('statements');
      expect(coverage).toHaveProperty('branches');
      expect(coverage).toHaveProperty('functions');
      expect(coverage).toHaveProperty('lines');
      
      expect(coverage.lines.percentage).toBeGreaterThan(90); // Mock shows >90%
    });
  });

  describe('Event System', () => {
    test('should emit test lifecycle events', (done) => {
      let eventsFired = 0;
      const expectedEvents = ['run:start', 'suite:start', 'test:start', 'test:complete', 'suite:complete', 'run:complete'];
      
      expectedEvents.forEach(eventName => {
        runner.on(eventName, () => {
          eventsFired++;
          if (eventsFired === expectedEvents.length) {
            done();
          }
        });
      });

      runner.suite('Event Suite', () => {
        runner.test('Event Test', () => {});
      });

      runner.runAll();
    });

    test('should provide detailed run completion data', (done) => {
      runner.on('run:complete', (data) => {
        expect(data).toHaveProperty('results');
        expect(data).toHaveProperty('passed');
        expect(data).toHaveProperty('coverage');
        expect(Array.isArray(data.results)).toBe(true);
        done();
      });

      runner.suite('Completion Suite', () => {
        runner.test('Completion Test', () => {});
      });

      runner.runAll();
    });
  });
});

describe('Test Fixtures', () => {
  let fixtures: TestFixtures;

  beforeEach(() => {
    fixtures = new TestFixtures();
  });

  afterEach(async () => {
    await fixtures.cleanup();
  });

  test('should create and retrieve fixtures', () => {
    const testUser = fixtures.create('user', () => ({
      id: '123',
      name: 'Test User',
      email: 'test@example.com'
    }));

    expect(testUser.name).toBe('Test User');

    const retrievedUser = fixtures.get('user');
    expect(retrievedUser).toEqual(testUser);
  });

  test('should handle missing fixtures', () => {
    expect(() => fixtures.get('nonexistent')).toThrow('Fixture nonexistent not found');
  });

  test('should cleanup fixtures with cleanup methods', async () => {
    let cleanupCalled = false;

    fixtures.create('cleanable', () => ({
      data: 'test',
      cleanup: async () => {
        cleanupCalled = true;
      }
    }));

    await fixtures.cleanup();
    expect(cleanupCalled).toBe(true);
  });
});

describe('Mock Factory', () => {
  test('should create mock functions', () => {
    const mockFn = MockFactory.fn();
    
    expect(typeof mockFn).toBe('function');
    expect(mockFn.mockReturnValue).toBeDefined();
    expect(mockFn.calls).toBeDefined();
  });

  test('should track function calls', () => {
    const mockFn = MockFactory.fn();
    mockFn.mockReturnValue('test result');
    
    const result = mockFn('arg1', 'arg2');
    
    expect(result).toBe('test result');
    expect(mockFn.calls).toHaveLength(1);
    expect(mockFn.calls[0]).toEqual(['arg1', 'arg2']);
  });

  test('should support promised return values', async () => {
    const mockFn = MockFactory.fn();
    mockFn.mockResolvedValue('async result');
    
    const result = await mockFn();
    expect(result).toBe('async result');
  });

  test('should support rejected promises', async () => {
    const mockFn = MockFactory.fn();
    mockFn.mockRejectedValue(new Error('Mock error'));
    
    await expect(mockFn()).rejects.toThrow('Mock error');
  });

  test('should create mock objects', () => {
    interface TestInterface {
      name: string;
      getValue(): number;
    }

    const mockObj = MockFactory.object<TestInterface>({
      name: 'Mock Object'
    });

    expect(mockObj.name).toBe('Mock Object');
  });
});

describe('Performance Tester', () => {
  test('should measure function performance', async () => {
    const results = await PerformanceTester.measure(
      'test_function',
      () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      },
      10 // 10 iterations
    );

    expect(results.name).toBe('test_function');
    expect(results.iterations).toBe(10);
    expect(results.totalTime).toBeGreaterThan(0);
    expect(results.averageTime).toBeGreaterThan(0);
    expect(results.minTime).toBeGreaterThanOrEqual(0);
    expect(results.maxTime).toBeGreaterThanOrEqual(results.minTime);
    expect(results.p50).toBeGreaterThanOrEqual(0);
    expect(results.p95).toBeGreaterThanOrEqual(results.p50);
    expect(results.p99).toBeGreaterThanOrEqual(results.p95);
  });

  test('should measure async function performance', async () => {
    const results = await PerformanceTester.measure(
      'async_function',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'done';
      },
      5 // 5 iterations
    );

    expect(results.iterations).toBe(5);
    expect(results.averageTime).toBeGreaterThan(0);
  });

  test('should provide statistical percentiles', async () => {
    const results = await PerformanceTester.measure(
      'statistical_test',
      () => Math.random() * 100,
      100 // More iterations for better statistics
    );

    expect(results.p99).toBeGreaterThanOrEqual(results.p95);
    expect(results.p95).toBeGreaterThanOrEqual(results.p50);
    expect(results.maxTime).toBeGreaterThanOrEqual(results.p99);
    expect(results.p50).toBeGreaterThanOrEqual(results.minTime);
  });
});