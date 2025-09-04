/**
 * Initial database schema for CodeCrucible Synth
 * Creates all necessary tables with proper indexes and constraints
 */

exports.up = async function (knex) {
  // Users table for authentication
  await knex.schema.createTable('users', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('username', 255).unique().notNullable();
    table.string('email', 255).unique();
    table.string('password_hash', 255).notNullable();
    table.string('salt', 255).notNullable();
    table.json('roles').defaultTo('[]');
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
    table.timestamp('last_login');
    table.integer('failed_login_attempts').defaultTo(0);
    table.boolean('account_locked').defaultTo(false);
    table.timestamp('lockout_expires');
    table.json('metadata').defaultTo('{}');
    table.timestamps(true, true);

    // Indexes
    table.index('username');
    table.index('email');
    table.index('status');
    table.index('created_at');
  });

  // Projects table
  await knex.schema.createTable('projects', table => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.text('path').unique().notNullable();
    table.string('project_type', 100);
    table.text('description');
    table.timestamp('last_analyzed');
    table.json('metadata').defaultTo('{}');
    table.timestamps(true, true);

    // Indexes
    table.index('name');
    table.index('project_type');
    table.index(['last_analyzed', 'created_at']);
  });

  // User sessions table
  await knex.schema.createTable('user_sessions', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('session_token', 255).unique().notNullable();
    table.string('refresh_token', 255).unique().notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.string('ip_address', 45); // IPv6 compatible
    table.text('user_agent');
    table.json('permissions').defaultTo('[]');
    table.json('roles').defaultTo('[]');
    table.timestamps(true, true);

    // Indexes
    table.index('user_id');
    table.index('session_token');
    table.index('expires_at');
    table.index('last_activity');
  });

  // Voice interactions table
  await knex.schema.createTable('voice_interactions', table => {
    table.increments('id').primary();
    table.uuid('session_id').notNullable();
    table.string('voice_name', 100).notNullable();
    table.text('prompt').notNullable();
    table.text('response').notNullable();
    table.decimal('confidence', 3, 2).notNullable();
    table.integer('tokens_used').notNullable();
    table.integer('response_time_ms');
    table.string('model_used', 100);
    table.json('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('session_id');
    table.index('voice_name');
    table.index('created_at');
    table.index(['voice_name', 'created_at']);
  });

  // Code analysis results table
  await knex.schema.createTable('code_analysis', table => {
    table.increments('id').primary();
    table.integer('project_id').references('id').inTable('projects').onDelete('CASCADE');
    table.text('file_path').notNullable();
    table.string('analysis_type', 100).notNullable();
    table.jsonb('results').notNullable(); // Use JSONB for better performance
    table.integer('quality_score');
    table.decimal('execution_time_ms', 10, 3);
    table.string('analyzer_version', 50);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('project_id');
    table.index('analysis_type');
    table.index('created_at');
    table.index('quality_score');
    // GIN index for JSONB queries
    table.index(knex.raw('results USING GIN'));
  });

  // Application configuration table
  await knex.schema.createTable('app_config', table => {
    table.string('key', 255).primary();
    table.jsonb('value').notNullable();
    table.text('description');
    table.boolean('encrypted').defaultTo(false);
    table.string('category', 100).defaultTo('general');
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('category');
    table.index('updated_at');
  });

  // Backup metadata table
  await knex.schema.createTable('backup_metadata', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('type', ['full', 'incremental', 'differential']).notNullable();
    table.bigInteger('size_bytes').notNullable();
    table.boolean('compressed').defaultTo(true);
    table.boolean('encrypted').defaultTo(false);
    table.string('checksum', 255).notNullable();
    table.string('version', 50).notNullable();
    table.string('source', 255).notNullable();
    table.text('destination').notNullable();
    table.string('storage_type', 50).defaultTo('local');
    table.json('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at');

    // Indexes
    table.index('type');
    table.index('created_at');
    table.index('expires_at');
    table.index('storage_type');
  });

  // Security audit log table
  await knex.schema.createTable('security_audit_log', table => {
    table.increments('id').primary();
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('session_id').references('id').inTable('user_sessions').onDelete('SET NULL');
    table
      .enum('event_type', [
        'login_success',
        'login_failure',
        'logout',
        'permission_denied',
        'data_access',
        'data_modification',
        'system_event',
        'security_violation',
      ])
      .notNullable();
    table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
    table.enum('outcome', ['success', 'failure', 'blocked']).notNullable();
    table.string('source_ip', 45);
    table.text('user_agent');
    table.string('resource', 255);
    table.text('description').notNullable();
    table.jsonb('details').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('user_id');
    table.index('event_type');
    table.index('severity');
    table.index('created_at');
    table.index(['event_type', 'severity', 'created_at']);
  });

  // Performance metrics table
  await knex.schema.createTable('performance_metrics', table => {
    table.increments('id').primary();
    table.string('metric_name', 255).notNullable();
    table.string('component', 100).notNullable();
    table.decimal('value', 15, 6).notNullable();
    table.string('unit', 50).notNullable();
    table.json('tags').defaultTo('{}');
    table.timestamp('timestamp').defaultTo(knex.fn.now());

    // Indexes
    table.index('metric_name');
    table.index('component');
    table.index('timestamp');
    table.index(['metric_name', 'timestamp']);
  });

  // RBAC permissions table
  await knex.schema.createTable('permissions', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).unique().notNullable();
    table.text('description');
    table.string('resource', 255).notNullable();
    table.string('action', 255).notNullable();
    table.jsonb('constraints').defaultTo('{}');
    table.boolean('is_system').defaultTo(false);
    table.timestamps(true, true);

    // Indexes
    table.index('name');
    table.index(['resource', 'action']);
  });

  // RBAC roles table
  await knex.schema.createTable('roles', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).unique().notNullable();
    table.text('description');
    table.json('permission_ids').defaultTo('[]');
    table.json('inherited_role_ids').defaultTo('[]');
    table.boolean('is_system').defaultTo(false);
    table.timestamps(true, true);

    // Indexes
    table.index('name');
    table.index('is_system');
  });

  // Error log table for system errors
  await knex.schema.createTable('error_log', table => {
    table.increments('id').primary();
    table.string('error_type', 255).notNullable();
    table.string('component', 255).notNullable();
    table.string('operation', 255);
    table.text('message').notNullable();
    table.text('stack_trace');
    table.jsonb('context').defaultTo('{}');
    table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
    table.boolean('resolved').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('resolved_at');

    // Indexes
    table.index('error_type');
    table.index('component');
    table.index('severity');
    table.index('created_at');
    table.index('resolved');
  });

  console.log('✅ Initial schema created successfully');
};

exports.down = async function (knex) {
  // Drop tables in reverse order to handle foreign key constraints
  const tables = [
    'error_log',
    'roles',
    'permissions',
    'performance_metrics',
    'security_audit_log',
    'backup_metadata',
    'app_config',
    'code_analysis',
    'voice_interactions',
    'user_sessions',
    'projects',
    'users',
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }

  console.log('✅ Initial schema dropped successfully');
};
