const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function run() {
  const user = await p.user.findUnique({ where: { email: "localhost@koda.com" } });
  if (!user) { console.log("User not found"); process.exit(1); }
  console.log("User ID:", user.id);

  const docs = await p.document.findMany({
    where: { userId: user.id },
    select: { id: true, filename: true, status: true },
    orderBy: { createdAt: "desc" }
  });
  console.log("Total docs:", docs.length);

  const s = {};
  docs.forEach(d => { s[d.status] = (s[d.status] || 0) + 1; });
  console.log("By status:", JSON.stringify(s));

  const chunks = await p.documentChunk.count({ where: { document: { userId: user.id } } });
  console.log("Total chunks:", chunks);

  console.log("\nDocuments:");
  docs.slice(0, 50).forEach(d => console.log("[" + d.status.padEnd(10) + "] " + d.filename));

  await p.$disconnect();
}
run();
