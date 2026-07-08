import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const users = await prisma.user.findMany();
    console.log('--- Database Users ---');
    users.forEach(u => {
        console.log(`- User: ${u.username}, Role: ${u.role}, Status: ${u.status}, HasKey: ${!!u.publicKey}`);
    });
    console.log('----------------------');
    await prisma.$disconnect();
}
main().catch(console.error);
