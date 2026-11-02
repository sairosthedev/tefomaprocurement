import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) process.exit(1);

const run = async () => {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db!;
  console.log(`DB: ${mongoose.connection.name}\n`);

  const departments = await db.collection('departments').find({}).toArray();
  console.log(`departments (${departments.length}):`);
  departments.forEach((d) => console.log(`  ${String(d._id)}  ${d.name} [${d.code}] head=${d.head ?? '-'}`));

  const users = await db
    .collection('users')
    .find({ role: { $in: ['department_head', 'end_user', 'procurement_officer'] } })
    .project({ email: 1, role: 1, department: 1 })
    .toArray();
  console.log(`\nusers with departments (${users.length}):`);
  users.forEach((u) => console.log(`  ${u.email} [${u.role}] dept=${u.department ?? '-'}`));

  const reqs = await db
    .collection('purchaserequisitions')
    .find({})
    .project({ requisitionNumber: 1, status: 1, department: 1, requestedBy: 1 })
    .toArray();
  console.log(`\nrequisitions (${reqs.length}):`);
  reqs.forEach((r) =>
    console.log(`  ${r.requisitionNumber} [${r.status}] dept=${r.department ?? '-'} by=${r.requestedBy ?? '-'}`)
  );

  process.exit(0);
};

run();
