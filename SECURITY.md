# Security Guidelines

## Secret Management

**NEVER commit secrets to git repositories, even if encrypted.**

### Proper Secret Storage:
- Use environment variables (`.env` files, gitignored)
- Use secret management systems (HashiCorp Vault, AWS Secrets Manager)
- Use CI/CD secret stores (GitHub Secrets, GitLab CI Variables)

### Migration Note:
The `secrets/` folder has been removed to eliminate security anti-patterns. If you previously stored audit signing keys or other secrets there:

1. Regenerate any keys that were committed to git
2. Store new keys in proper secret management systems
3. Update application configuration to read from environment variables

### Environment Variables:
```bash
# Required environment variables
SMITHERY_API_KEY=your_smithery_key_here
AUDIT_SIGNING_KEY=regenerated_key_here
```

See `.env.example` for complete environment configuration.