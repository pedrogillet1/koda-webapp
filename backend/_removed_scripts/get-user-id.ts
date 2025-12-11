import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getUserId() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email: '123hackerabc@example.com'
      }
    });

    if (user) {
      console.log('User found!');
      console.log('User ID:', user.id);
      console.log('Email:', user.email);
    } else {
      console.log('User not found with email: 123hackerabc@example.com');
      console.log('\nSearching for users with similar emails...');

      const users = await prisma.user.findMany({
        where: {
          email: {
            contains: '123hackerabc'
          }
        }
      });

      if (users.length > 0) {
        console.log('Found users:');
        users.forEach(u => {
          console.log(`  - ID: ${u.id}, Email: ${u.email}`);
        });
      } else {
        console.log('No users found containing "123hackerabc"');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getUserId();
