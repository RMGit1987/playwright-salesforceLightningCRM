import fs from 'fs';
import path from 'path';
import type { FullConfig, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

type FailureInsight = {
  title: string;
  projectName: string;
  outcome: string;
  file?: string;
  line?: number;
  errorSummary: string;
  attachmentNames: string[];
  pageSourcePath?: string;
  pageUrlPath?: string;
};

class FailureIntelligenceReporter implements Reporter {
  private readonly insights: FailureInsight[] = [];
  private outputFile = '';
  private markdownFile = '';

  onBegin(_config: FullConfig, _suite: Suite): void {
    const runDir = process.env.PW_RUN_DIR || path.join(process.cwd(), 'test-results');
    this.outputFile = path.join(runDir, 'failure-insights.jsonl');
    this.markdownFile = path.join(runDir, 'failure-insights.md');
    fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
  }

  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    if (result.status === 'passed' || result.status === 'skipped') return;

    const errorSummary =
      result.error?.message?.split('\n').map((line) => line.trim()).find(Boolean) ||
      result.errors?.map((error) => error.message?.trim()).find(Boolean) ||
      'No failure message captured.';

    const pageSourceAttachment = result.attachments.find((attachment) => attachment.name === 'failure-page-source');
    const pageUrlAttachment = result.attachments.find((attachment) => attachment.name === 'failure-page-url');
    const insight: FailureInsight = {
      title: test.titlePath().join(' > '),
      projectName: test.parent.project()?.name || 'unknown',
      outcome: result.status,
      file: test.location.file,
      line: test.location.line,
      errorSummary,
      attachmentNames: result.attachments.map((attachment) => attachment.name),
      pageSourcePath: pageSourceAttachment?.path,
      pageUrlPath: pageUrlAttachment?.path,
    };

    this.insights.push(insight);
    await fs.promises.appendFile(this.outputFile, `${JSON.stringify(insight)}\n`, 'utf8');
  }

  onEnd(): void {
    const lines = ['### Failure Intelligence'];
    if (!this.insights.length) {
      lines.push('- No unexpected failures were recorded.');
    } else {
      for (const insight of this.insights) {
        lines.push(`- [${insight.projectName}] ${insight.title}`);
        lines.push(`  Why: ${insight.errorSummary}`);
        if (insight.pageSourcePath) lines.push(`  Page source: ${insight.pageSourcePath}`);
        if (insight.pageUrlPath) lines.push(`  URL: ${insight.pageUrlPath}`);
      }
    }

    fs.writeFileSync(this.markdownFile, `${lines.join('\n')}\n`, 'utf8');
  }
}

export default FailureIntelligenceReporter;
