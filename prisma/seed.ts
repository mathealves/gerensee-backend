import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, TaskPriority } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // --- Demo Owner User ---
  const passwordHash = await bcrypt.hash('Demo@1234', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.gerensee.io' },
    update: {},
    create: {
      email: 'owner@demo.gerensee.io',
      name: 'Demo Owner',
      passwordHash,
    },
  });

  // --- Demo Organization ---
  const org = await prisma.organization.upsert({
    where: { name: 'Gerensee Demo' },
    update: {},
    create: {
      name: 'Gerensee Demo',
    },
  });

  // --- Owner Member Record ---
  const ownerMember = await prisma.member.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    update: {},
    create: {
      userId: owner.id,
      organizationId: org.id,
      role: Role.OWNER,
    },
  });

  // --- Demo Project ---
  const project = await prisma.project.upsert({
    where: { name_organizationId: { name: 'Demo Project', organizationId: org.id } },
    update: {},
    create: {
      name: 'Demo Project',
      description: 'A sample project to get you started',
      organizationId: org.id,
      createdById: owner.id,
    },
  });

  // --- Project Member ---
  await prisma.projectMember.upsert({
    where: { projectId_memberId: { projectId: project.id, memberId: ownerMember.id } },
    update: {},
    create: {
      projectId: project.id,
      memberId: ownerMember.id,
    },
  });

  // --- Default Task Statuses ---
  const statuses = [
    { name: 'To Do', position: 0, color: '#94a3b8' },
    { name: 'In Progress', position: 1, color: '#3b82f6' },
    { name: 'Done', position: 2, color: '#22c55e' },
  ];

  const createdStatuses: { id: string; name: string }[] = [];
  for (const s of statuses) {
    const status = await prisma.taskStatus.upsert({
      where: { projectId_position: { projectId: project.id, position: s.position } },
      update: {},
      create: { ...s, projectId: project.id },
    });
    createdStatuses.push({ id: status.id, name: status.name });
  }

  // --- Demo Task ---
  const todoStatus = createdStatuses.find((s) => s.name === 'To Do');
  if (todoStatus) {
    const existingTask = await prisma.task.findFirst({
      where: { title: 'Welcome to Gerensee!', projectId: project.id },
    });
    if (!existingTask) {
      await prisma.task.create({
        data: {
          title: 'Welcome to Gerensee!',
          description: 'This is your first task. Click to edit or drag to move.',
          priority: TaskPriority.MEDIUM,
          statusId: todoStatus.id,
          projectId: project.id,
          organizationId: org.id,
          createdById: owner.id,
        },
      });
    }
  }

  console.log('✅ Seed complete!');
  console.log(`   Organization: ${org.name}`);
  console.log(`   Owner email:  owner@demo.gerensee.io`);
  console.log(`   Password:     Demo@1234`);
  console.log(`   Project:      ${project.name}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
