import { APIRequestContext } from '@playwright/test';
import { loadEnv } from '../../../utils/loadEnv';

loadEnv();

interface SalesforceAuthResponse {
  access_token: string;
  instance_url?: string;
  id?: string;
  token_type: string;
  issued_at?: string;
  signature?: string;
}

export class SalesforceApiClient {
  private accessToken: string | null = null;
  private instanceUrl: string;
  private authError: string | null = null;

  constructor(
    private readonly request: APIRequestContext,
    instanceUrl?: string
  ) {
    this.instanceUrl =
      instanceUrl ||
      process.env.SALESFORCE_INSTANCE_URL ||
      process.env.SALESFORCE_BASE_URL ||
      '';
  }

  private buildAuthUrlCandidates(): string[] {
    const candidates = [
      process.env.SALESFORCE_AUTH_URL,
      process.env.SALESFORCE_INSTANCE_URL,
      process.env.SALESFORCE_BASE_URL,
    ]
      .filter((value): value is string => !!value)
      .map((value) => {
        try {
          return new URL(value).origin;
        } catch {
          return value.replace(/\/+$/, '');
        }
      })
      // Lightning hosts are valid for browser navigation, but not for the OAuth token endpoint.
      .filter((value) => {
        try {
          return !new URL(value).hostname.endsWith('.lightning.force.com');
        } catch {
          return true;
        }
      });

    if (candidates.length > 0) {
      return [...new Set(candidates)];
    }

    const fallbackCandidates = [
      process.env.SALESFORCE_AUTH_URL,
      process.env.SALESFORCE_INSTANCE_URL,
      process.env.SALESFORCE_BASE_URL,
    ]
      .filter((value): value is string => !!value)
      .map((value) => {
        try {
          return new URL(value).origin;
        } catch {
          return value.replace(/\/+$/, '');
        }
      });

    return [...new Set(fallbackCandidates)];
  }

  async authenticate() {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
    const authUrlCandidates = this.buildAuthUrlCandidates();

    if (clientId && clientSecret) {
      const errors: string[] = [];

      for (const authUrl of authUrlCandidates) {
        const response = await this.request.post(`${authUrl}/services/oauth2/token`, {
          form: {
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
          },
        });

        if (response.ok()) {
          const body: SalesforceAuthResponse = await response.json();
          this.accessToken = body.access_token;
          this.instanceUrl = body.instance_url || this.instanceUrl;
          this.authError = null;
          return;
        }

        const errorBody = await response.text().catch(() => '');
        errors.push(
          `${authUrl} -> status ${response.status()}: ${errorBody || 'authentication failure'}`,
        );
      }

      this.authError = `Salesforce OAuth client credentials flow failed. Attempts: ${errors.join(' | ')}`;
    }

    this.accessToken = process.env.SALESFORCE_ACCESS_TOKEN || null;
    if (!this.accessToken) {
      if (this.authError) {
        console.warn(`[SalesforceApiClient] ${this.authError}`);
      } else {
        console.warn('[SalesforceApiClient] No API auth credentials configured. API tests requiring auth will be skipped.');
        console.warn(
          '[SalesforceApiClient] Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET for client credentials flow, or provide SALESFORCE_ACCESS_TOKEN in .env.',
        );
      }
    }
  }

  private async ensureAuthenticated() {
    if (!this.accessToken) {
      await this.authenticate();
    }
    if (!this.accessToken) {
      if (this.authError) {
        throw new Error(this.authError);
      }
      throw new Error(
        'Salesforce API auth is not configured. Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET for client credentials flow, or SALESFORCE_ACCESS_TOKEN.',
      );
    }
    if (!this.instanceUrl) {
      throw new Error(
        'Salesforce instance URL is not configured. Set SALESFORCE_INSTANCE_URL or SALESFORCE_BASE_URL in .env.',
      );
    }
  }

  async createRecord(sobjectType: string, data: Record<string, unknown>) {
    await this.ensureAuthenticated();
    const version = process.env.SALESFORCE_API_VERSION || '62.0';
    const response = await this.request.post(
      `${this.instanceUrl}/services/data/v${version}/sobjects/${sobjectType}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data,
      }
    );
    return response;
  }

  async getRecord(sobjectType: string, recordId: string) {
    await this.ensureAuthenticated();
    const version = process.env.SALESFORCE_API_VERSION || '62.0';
    const response = await this.request.get(
      `${this.instanceUrl}/services/data/v${version}/sobjects/${sobjectType}/${recordId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
    return response;
  }

  async updateRecord(sobjectType: string, recordId: string, data: Record<string, unknown>) {
    await this.ensureAuthenticated();
    const version = process.env.SALESFORCE_API_VERSION || '62.0';
    const response = await this.request.patch(
      `${this.instanceUrl}/services/data/v${version}/sobjects/${sobjectType}/${recordId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        data,
      }
    );
    return response;
  }

  async deleteRecord(sobjectType: string, recordId: string) {
    await this.ensureAuthenticated();
    const version = process.env.SALESFORCE_API_VERSION || '62.0';
    const response = await this.request.delete(
      `${this.instanceUrl}/services/data/v${version}/sobjects/${sobjectType}/${recordId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
    return response;
  }

  async query(soql: string) {
    await this.ensureAuthenticated();
    const version = process.env.SALESFORCE_API_VERSION || '62.0';
    const encodedQuery = encodeURIComponent(soql);
    const response = await this.request.get(
      `${this.instanceUrl}/services/data/v${version}/query?q=${encodedQuery}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
    return response;
  }

  async describe(sobjectType: string) {
    await this.ensureAuthenticated();
    const version = process.env.SALESFORCE_API_VERSION || '62.0';
    const response = await this.request.get(
      `${this.instanceUrl}/services/data/v${version}/sobjects/${sobjectType}/describe`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
    return response;
  }
}
