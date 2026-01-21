import { prisma } from '../lib/prisma'

async function main() {
    const admin = await prisma.user.upsert({
        where: { email: 'admin@gerensee.com'},
        update: {},
        create: {
            email: 'admin@gerensee.com',
            name: 'admin ',
        },
    })

    const organization = await prisma.organization.upsert({
        where: { name: 'Gerensee Org' },
        update: {},
        create: {
            name: 'Gerensee Org',
        },
    })

    const member = await prisma.member.upsert({
        where: { userId_organizationId:
    {
        userId: admin.id, organizationId
    :
        organization.id
    }
},
        update: {},
        create: {
            role: 'OWNER',
            userId: admin.id,
            organizationId: organization.id,
        },
    })

    const project = await prisma.project.upsert({
        where: { name_organizationId: {
        name: 'Gerensee Engineering Board', organizationId: organization.id}
        },
        update: {},
        create: {
            name: 'Gerensee Engineering Board',
            organizationId: organization.id,
            taskStatuses: {
                create:
                    [
                        { name: 'A fazer', order: 1 },
                        { name: 'Em execução', order: 2 },
                        { name: 'Pronto', order: 3 },
                    ]
                }
            },
        })
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
