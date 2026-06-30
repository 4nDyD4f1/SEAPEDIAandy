const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // 1. Delete Andy's account
  try {
    const andy = await prisma.user.findUnique({
      where: { email: 'andydafi407@gmail.com' }
    });
    
    if (andy) {
      await prisma.user.delete({
        where: { email: 'andydafi407@gmail.com' }
      });
      console.log('Successfully deleted Andy Muhammad Dafi Tombolotutu account.');
    } else {
      console.log('Andy Muhammad Dafi Tombolotutu account not found.');
    }
  } catch (err) {
    console.error('Error deleting Andy account:', err.message);
  }

  // 2. Create users with specific roles
  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  const accounts = [
    { name: 'Seapedia Admin', email: 'admin@seapedia.com', roles: ['ADMIN'] },
    { name: 'Seapedia Buyer', email: 'buyer@seapedia.com', roles: ['BUYER'] },
    { name: 'Seapedia Seller', email: 'seller@seapedia.com', roles: ['SELLER'] },
    { name: 'Seapedia Driver', email: 'driver@seapedia.com', roles: ['DRIVER'] },
    { name: 'Seapedia Multirole', email: 'multirole@seapedia.com', roles: ['BUYER', 'SELLER', 'DRIVER'] },
  ];

  for (const acc of accounts) {
    try {
      const existing = await prisma.user.findUnique({
        where: { email: acc.email }
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            name: acc.name,
            email: acc.email,
            passwordHash,
            walletBalance: 1000000,
            roles: {
              create: acc.roles.map(r => ({ role: r }))
            }
          }
        });
        console.log(`Created account: ${acc.email} with roles: ${acc.roles.join(', ')}`);
      } else {
        // Ensure roles are correct
        const currentRoles = await prisma.userRole.findMany({ where: { userId: existing.id } });
        const existingRoleNames = currentRoles.map(r => r.role);
        
        for (const r of acc.roles) {
          if (!existingRoleNames.includes(r)) {
            await prisma.userRole.create({
              data: {
                userId: existing.id,
                role: r
              }
            });
            console.log(`Added role ${r} to existing account ${acc.email}`);
          }
        }
        console.log(`Account ${acc.email} already exists.`);
      }
    } catch (err) {
      console.error(`Error creating account ${acc.email}:`, err.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
