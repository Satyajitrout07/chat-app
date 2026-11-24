import { getDbClient } from './index';

export async function seedDatabase(): Promise<void> {
  const db = getDbClient();
  console.log('Seeding initial users...');

  const users = [
    { id: 'user_1', name: 'Alice Smith', email: 'alice@example.com' },
    { id: 'user_2', name: 'Bob Jones', email: 'bob@example.com' },
    { id: 'user_3', name: 'Charlie Brown', email: 'charlie@example.com' },
  ];

  for (const u of users) {
    await db.query(
      `INSERT INTO users (id, name, email) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;`,
      [u.id, u.name, u.email]
    );
  }

  console.log('Seeding complete.');
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seed finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
