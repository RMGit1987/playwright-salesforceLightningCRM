import { faker } from '@faker-js/faker';

export function buildUniqueEmail(prefix = 'sf'): string {
  return `${prefix}.${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test-automation.example.com`;
}

export function buildUniqueUsername(prefix = 'sfUser'): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function buildUniqueName(prefix = 'Test'): string {
  return `${prefix} ${Date.now()}`;
}

export function buildLeadPayload() {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    company: faker.company.name(),
    email: buildUniqueEmail('lead'),
    phone: faker.phone.number(),
    title: faker.person.jobTitle(),
    industry: faker.helpers.arrayElement(['Technology', 'Healthcare', 'Finance', 'Manufacturing']),
    status: 'Open - Not Contacted',
  };
}

export function buildAccountPayload() {
  return {
    name: `${faker.company.name()} ${Date.now()}`,
    phone: faker.phone.number(),
    industry: faker.helpers.arrayElement(['Technology', 'Healthcare', 'Finance', 'Manufacturing']),
    type: 'Customer',
    website: faker.internet.url(),
  };
}

export function buildContactPayload() {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: buildUniqueEmail('contact'),
    phone: faker.phone.number(),
    title: faker.person.jobTitle(),
  };
}

export function buildOpportunityPayload() {
  return {
    name: `${faker.commerce.productName()} - ${Date.now()}`,
    stage: 'Prospecting',
    closeDate: faker.date.future().toLocaleDateString('en-US'),
    amount: faker.number.float({ min: 1000, max: 100000, fractionDigits: 2 }),
    type: 'New Customer',
  };
}

export function buildCasePayload() {
  return {
    subject: `Test Case - ${faker.lorem.sentence()}`,
    description: faker.lorem.paragraph(),
    status: 'New',
    priority: 'Medium',
    origin: 'Web',
  };
}
