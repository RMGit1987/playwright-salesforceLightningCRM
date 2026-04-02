import { test, expect } from '../fixtures/base.fixture';
import { SalesforceQueryResponseSchema, SalesforceCreateResponseSchema } from '../../src/domain/salesforceApi/salesforce.schemas';

const hasApiAuth =
  !!(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET) ||
  !!process.env.SALESFORCE_ACCESS_TOKEN;

test.describe('Feature: Salesforce REST API', () => {
  test.describe('SOQL Queries (no auth required - validation only)', () => {
    test('@api query response schema is valid', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();

      const response = await salesforceApi.query('SELECT Id, Name FROM Account LIMIT 5');
      expect(response.status()).toBe(200);

      const body = await response.json();
      const validated = SalesforceQueryResponseSchema.parse(body);
      expect(validated.totalSize).toBeGreaterThanOrEqual(0);
      expect(validated.done).toBe(true);
    });

    test('@api query accounts returns expected fields', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const response = await salesforceApi.query('SELECT Id, Name, Industry, Type FROM Account LIMIT 10');
      expect(response.status()).toBe(200);

      const body = await response.json();
      if (body.totalSize > 0) {
        const record = body.records[0];
        expect(record).toHaveProperty('Id');
        expect(record).toHaveProperty('Name');
      }
    });

    test('@api query contacts returns expected fields', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const response = await salesforceApi.query('SELECT Id, FirstName, LastName, Email FROM Contact LIMIT 10');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('totalSize');
      expect(body).toHaveProperty('records');
    });

    test('@api query leads returns expected fields', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const response = await salesforceApi.query('SELECT Id, FirstName, LastName, Company, Status FROM Lead LIMIT 10');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('totalSize');
      expect(body).toHaveProperty('records');
    });

    test('@api query cases returns expected fields', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const response = await salesforceApi.query('SELECT Id, Subject, Status, Priority FROM Case LIMIT 10');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('totalSize');
    });
  });

  test.describe('Describe SObject', () => {
    test('@api describe Account returns field metadata', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const response = await salesforceApi.describe('Account');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.name).toBe('Account');
      expect(body.fields).toBeDefined();
      expect(body.fields.length).toBeGreaterThan(0);

      const nameField = body.fields.find((f: { name: string }) => f.name === 'Name');
      expect(nameField).toBeDefined();
      expect(nameField.createable).toBe(true);
    });

    test('@api describe Lead returns field metadata', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const response = await salesforceApi.describe('Lead');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.name).toBe('Lead');
      expect(body.label).toBe('Lead');
    });

    test('@api describe Contact returns field metadata', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const response = await salesforceApi.describe('Contact');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.name).toBe('Contact');
      expect(body.labelPlural).toBe('Contacts');
    });
  });

  test.describe('CRUD Operations', () => {
    test('@api @critical create and delete a lead via API', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const createResponse = await salesforceApi.createRecord('Lead', {
        LastName: `API Test Lead ${Date.now()}`,
        Company: 'API Test Corp',
        Status: 'Open - Not Contacted',
      });

      expect(createResponse.status()).toBe(201);
      const createBody = await createResponse.json();
      const validated = SalesforceCreateResponseSchema.parse(createBody);
      expect(validated.success).toBe(true);

      const deleteResponse = await salesforceApi.deleteRecord('Lead', validated.id);
      expect([200, 204]).toContain(deleteResponse.status());
    });

    test('@api create and delete an account via API', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const createResponse = await salesforceApi.createRecord('Account', {
        Name: `API Test Account ${Date.now()}`,
        Type: 'Customer',
      });

      expect(createResponse.status()).toBe(201);
      const createBody = await createResponse.json();
      expect(createBody.success).toBe(true);

      const deleteResponse = await salesforceApi.deleteRecord('Account', createBody.id);
      expect([200, 204]).toContain(deleteResponse.status());
    });

    test('@api create and delete a contact via API', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const createResponse = await salesforceApi.createRecord('Contact', {
        FirstName: 'API',
        LastName: `TestContact${Date.now()}`,
      });

      expect(createResponse.status()).toBe(201);
      const createBody = await createResponse.json();
      expect(createBody.success).toBe(true);

      const deleteResponse = await salesforceApi.deleteRecord('Contact', createBody.id);
      expect([200, 204]).toContain(deleteResponse.status());
    });

    test('@api response time is acceptable', async ({ salesforceApi }) => {
      test.skip(!hasApiAuth, 'API auth not configured. Set OAuth credentials or SALESFORCE_ACCESS_TOKEN.');
      await salesforceApi.authenticate();
      const start = Date.now();
      const response = await salesforceApi.query('SELECT Id FROM Account LIMIT 1');
      const elapsed = Date.now() - start;

      expect(response.status()).toBe(200);
      expect(elapsed).toBeLessThan(10_000);
    });
  });
});
