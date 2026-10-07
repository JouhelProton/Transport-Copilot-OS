import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/modules/auth/password.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL es obligatoria para ejecutar el seed");

const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DEMO_PASSWORD = "Demo-Transport-2026!";
const passwordHash = await hashPassword(DEMO_PASSWORD);

const pickup = new Date();
pickup.setDate(pickup.getDate() + 1);
pickup.setHours(8, 0, 0, 0);
const delivery = new Date(pickup);
delivery.setHours(16, 30, 0, 0);

await database.$transaction(async (tx) => {
  await tx.session.deleteMany();
  await tx.auditLog.deleteMany();
  await tx.serviceEvent.deleteMany();
  await tx.assignment.deleteMany();
  await tx.service.deleteMany();
  await tx.order.deleteMany();
  await tx.driver.deleteMany();
  await tx.vehicle.deleteMany();
  await tx.customer.deleteMany();
  await tx.membership.deleteMany();
  await tx.user.deleteMany();
  await tx.organization.deleteMany();

  await tx.organization.createMany({
    data: [
      { id: "org_tvd", name: "Transportes Valencia Demo", kind: "CARRIER" },
      { id: "org_nova", name: "Nova Distribución (ficticio)", kind: "SHIPPER" },
      { id: "org_other", name: "Transportes Norte Aislado", kind: "CARRIER" },
    ],
  });

  await tx.user.createMany({
    data: [
      {
        id: "u_cust",
        name: "Laura Pérez (DEV)",
        email: "cliente@demo.nexo.local",
        passwordHash,
      },
      {
        id: "u_admin",
        name: "Andrés Martí (DEV)",
        email: "admin@demo.nexo.local",
        passwordHash,
      },
      {
        id: "u_disp",
        name: "Sara Ruiz (DEV)",
        email: "trafico@demo.nexo.local",
        passwordHash,
      },
      {
        id: "u_ops",
        name: "Pablo Soler (DEV)",
        email: "operaciones@demo.nexo.local",
        passwordHash,
      },
      {
        id: "u_acc",
        name: "Elena Vidal (DEV)",
        email: "contabilidad@demo.nexo.local",
        passwordHash,
      },
      {
        id: "u_drv",
        name: "Miguel García (DEV)",
        email: "conductor@demo.nexo.local",
        passwordHash,
      },
      {
        id: "u_other",
        name: "Tenant Norte (DEV)",
        email: "norte@demo.nexo.local",
        passwordHash,
      },
      {
        id: "u_nomembership",
        name: "Usuario sin organización (DEV)",
        email: "sin-organizacion@demo.nexo.local",
        passwordHash,
      },
    ],
  });

  await tx.membership.createMany({
    data: [
      { userId: "u_cust", organizationId: "org_nova", role: "CUSTOMER" },
      { userId: "u_admin", organizationId: "org_tvd", role: "TRANSPORT_ADMIN" },
      { userId: "u_disp", organizationId: "org_tvd", role: "DISPATCHER" },
      { userId: "u_ops", organizationId: "org_tvd", role: "OPERATIONS" },
      { userId: "u_acc", organizationId: "org_tvd", role: "ACCOUNTING" },
      { userId: "u_drv", organizationId: "org_tvd", role: "DRIVER" },
      {
        userId: "u_other",
        organizationId: "org_other",
        role: "TRANSPORT_ADMIN",
      },
    ],
  });

  await tx.customer.createMany({
    data: [
      {
        id: "cus_nova",
        organizationId: "org_tvd",
        customerOrganizationId: "org_nova",
        userId: "u_cust",
        name: "Nova Distribución (ficticio)",
        contact: "Laura Pérez (DEV)",
      },
      {
        id: "cus_other_tenant",
        organizationId: "org_other",
        customerOrganizationId: "org_other",
        name: "Cliente Norte interno",
        contact: "Tenant Norte (DEV)",
      },
    ],
  });

  await tx.driver.createMany({
    data: [
      {
        id: "drv_miguel",
        organizationId: "org_tvd",
        userId: "u_drv",
        name: "Miguel García",
        phone: "+34 600 000 001",
        license: "C+E",
        status: "ACTIVE",
      },
      {
        id: "drv_ana",
        organizationId: "org_tvd",
        name: "Ana Llorens",
        phone: "+34 600 000 002",
        license: "C+E",
        status: "ACTIVE",
      },
      {
        id: "drv_jordi",
        organizationId: "org_tvd",
        name: "Jordi Ferrer",
        phone: "+34 600 000 003",
        license: "C",
        status: "RESTING",
      },
      {
        id: "drv_other",
        organizationId: "org_other",
        name: "Conductor Norte",
        phone: "+34 600 100 001",
        license: "C+E",
        status: "ACTIVE",
      },
    ],
  });

  await tx.vehicle.createMany({
    data: [
      {
        id: "veh_1234",
        organizationId: "org_tvd",
        plate: "1234 ABC",
        type: "Tráiler frigorífico",
        reefer: true,
        status: "IN_SERVICE",
      },
      {
        id: "veh_5678",
        organizationId: "org_tvd",
        plate: "5678 DEF",
        type: "Lona 13,6 m",
        reefer: false,
        status: "AVAILABLE",
      },
      {
        id: "veh_9012",
        organizationId: "org_tvd",
        plate: "9012 GHI",
        type: "Rígido frigorífico",
        reefer: true,
        status: "AVAILABLE",
      },
      {
        id: "veh_other",
        organizationId: "org_other",
        plate: "0001 NRT",
        type: "Lona",
        reefer: false,
        status: "AVAILABLE",
      },
    ],
  });

  await tx.order.create({
    data: {
      id: "ord_nv_24081_real",
      organizationId: "org_nova",
      carrierOrganizationId: "org_tvd",
      customerId: "cus_nova",
      createdByUserId: "u_cust",
      reference: "NV-24081-REAL",
      originName: "Valencia — Plataforma Puerto",
      originAddress: "Puerto de Valencia",
      originLat: 39.4699,
      originLng: -0.3763,
      destinationName: "Madrid — Centro Nova",
      destinationAddress: "Getafe, Madrid",
      destinationLat: 40.3057,
      destinationLng: -3.7329,
      cargo: "Alimentación refrigerada",
      pallets: 24,
      tempMin: 2,
      tempMax: 6,
      plannedPickup: pickup,
      plannedDelivery: delivery,
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });

  await tx.service.create({
    data: {
      id: "svc_nv_24081_real",
      organizationId: "org_tvd",
      customerOrganizationId: "org_nova",
      customerId: "cus_nova",
      orderId: "ord_nv_24081_real",
      status: "ASSIGNED",
    },
  });
  await tx.assignment.create({
    data: {
      id: "asn_nv_24081_real",
      organizationId: "org_tvd",
      serviceId: "svc_nv_24081_real",
      driverId: "drv_miguel",
      vehicleId: "veh_1234",
      assignedByUserId: "u_admin",
    },
  });

  await tx.order.create({
    data: {
      id: "ord_other_private",
      organizationId: "org_other",
      carrierOrganizationId: "org_other",
      customerId: "cus_other_tenant",
      createdByUserId: "u_other",
      reference: "NORTE-PRIVADO-001",
      originName: "Bilbao",
      originAddress: "Bilbao",
      originLat: 43.263,
      originLng: -2.935,
      destinationName: "Santander",
      destinationAddress: "Santander",
      destinationLat: 43.4623,
      destinationLng: -3.81,
      cargo: "Carga privada del tenant norte",
      pallets: 8,
      plannedPickup: pickup,
      plannedDelivery: delivery,
    },
  });

  await tx.serviceEvent.createMany({
    data: [
      {
        organizationId: "org_nova",
        orderId: "ord_nv_24081_real",
        serviceId: "svc_nv_24081_real",
        type: "ORDER_CREATED",
        entityType: "Order",
        entityId: "ord_nv_24081_real",
        actorUserId: "u_cust",
        correlationId: "seed-nv-24081",
        payload: { seeded: true },
      },
      {
        organizationId: "org_tvd",
        orderId: "ord_nv_24081_real",
        serviceId: "svc_nv_24081_real",
        type: "ORDER_ACCEPTED",
        entityType: "Order",
        entityId: "ord_nv_24081_real",
        actorUserId: "u_admin",
        correlationId: "seed-nv-24081",
        payload: { seeded: true },
      },
      {
        organizationId: "org_tvd",
        orderId: "ord_nv_24081_real",
        serviceId: "svc_nv_24081_real",
        type: "SERVICE_CREATED",
        entityType: "Service",
        entityId: "svc_nv_24081_real",
        actorUserId: "u_admin",
        correlationId: "seed-nv-24081",
        payload: { seeded: true },
      },
      {
        organizationId: "org_other",
        orderId: "ord_other_private",
        type: "ORDER_CREATED",
        entityType: "Order",
        entityId: "ord_other_private",
        actorUserId: "u_other",
        correlationId: "seed-other-private",
        payload: { seeded: true },
      },
    ],
  });
});

console.log(
  "Seed completado. Credenciales locales: *@demo.nexo.local / Demo-Transport-2026!",
);
await database.$disconnect();
