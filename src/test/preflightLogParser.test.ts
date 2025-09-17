import { expect } from 'chai';
import {
  PreflightLogParser,
  createPreflightLogParser,
  parsePreflightOutput
} from '../preflightLogParser';

describe('PreflightLogParser', () => {
  let parser: PreflightLogParser;

  beforeEach(() => {
    parser = new PreflightLogParser();
  });

  describe('parseLine', () => {
    it('should parse valid JSON log entry', () => {
      const line = '{"level":"info","msg":"resource validation completed","time":"2024-09-17T10:30:00Z"}';
      const result = parser.parseLine(line);
      
      expect(result).to.be.true;
      
      const entries = parser.getEntries();
      expect(entries).to.have.length(1);
      expect(entries[0]).to.deep.equal({
        level: 'info',
        msg: 'resource validation completed',
        time: '2024-09-17T10:30:00Z'
      });
    });

    it('should reject invalid JSON', () => {
      const line = 'invalid json line';
      const result = parser.parseLine(line);
      
      expect(result).to.be.false;
      expect(parser.getEntries()).to.have.length(0);
    });

    it('should reject empty or whitespace-only lines', () => {
      expect(parser.parseLine('')).to.be.false;
      expect(parser.parseLine('   ')).to.be.false;
      expect(parser.parseLine('\n')).to.be.false;
      expect(parser.getEntries()).to.have.length(0);
    });

    it('should reject JSON missing required fields', () => {
      const lineNoLevel = '{"msg":"test","time":"2024-09-17T10:30:00Z"}';
      const lineNoMsg = '{"level":"info","time":"2024-09-17T10:30:00Z"}';
      const lineNoTime = '{"level":"info","msg":"test"}';
      
      expect(parser.parseLine(lineNoLevel)).to.be.false;
      expect(parser.parseLine(lineNoMsg)).to.be.false;
      expect(parser.parseLine(lineNoTime)).to.be.false;
      expect(parser.getEntries()).to.have.length(0);
    });

    it('should parse all valid log levels', () => {
      const levels = ['info', 'error', 'warn', 'debug', 'fatal'];
      
      levels.forEach((level, index) => {
        const line = `{"level":"${level}","msg":"test message","time":"2024-09-17T10:30:0${index}Z"}`;
        expect(parser.parseLine(line)).to.be.true;
      });
      
      const entries = parser.getEntries();
      expect(entries).to.have.length(5);
      expect(entries.map(e => e.level)).to.deep.equal(levels);
    });

    it('should parse fatal log entry with real example', () => {
      const line = '{"level":"fatal","msg":"failed to show plan file: exit status 1\\n","time":"2025-09-17T09:29:40+08:00"}';
      const result = parser.parseLine(line);
      
      expect(result).to.be.true;
      
      const entries = parser.getEntries();
      expect(entries).to.have.length(1);
      expect(entries[0]).to.deep.equal({
        level: 'fatal',
        msg: 'failed to show plan file: exit status 1\n',
        time: '2025-09-17T09:29:40+08:00'
      });
    });
  });

  describe('parseOutput', () => {
    it('should parse multiple valid JSON lines', () => {
      const output = `{"level":"info","msg":"Starting validation","time":"2024-09-17T10:30:00Z"}
{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T10:30:01Z"}
{"level":"info","msg":"total terraform resources: 4, success: 4, failed: 0","time":"2024-09-17T10:30:02Z"}`;
      
      const entries = parser.parseOutput(output);
      
      expect(entries).to.have.length(3);
      expect(entries[0].msg).to.equal('Starting validation');
      expect(entries[1].msg).to.equal('azurerm_resource_group.main: success');
      expect(entries[2].msg).to.equal('total terraform resources: 4, success: 4, failed: 0');
    });

    it('should skip invalid lines and parse valid ones', () => {
      const output = `invalid line
{"level":"info","msg":"valid entry","time":"2024-09-17T10:30:00Z"}
another invalid line
{"level":"warn","msg":"another valid entry","time":"2024-09-17T10:30:01Z"}`;
      
      const entries = parser.parseOutput(output);
      
      expect(entries).to.have.length(2);
      expect(entries[0].level).to.equal('info');
      expect(entries[1].level).to.equal('warn');
    });

    it('should handle empty output', () => {
      const entries = parser.parseOutput('');
      expect(entries).to.have.length(0);
    });
  });

  describe('Resource Results Parsing', () => {
    it('should parse successful resource validation', () => {
      const line = '{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T10:30:00Z"}';
      parser.parseLine(line);
      
      const results = parser.getResourceResults();
      expect(results).to.have.length(1);
      expect(results[0]).to.deep.equal({
        resource: 'azurerm_resource_group.main',
        status: 'success'
      });
    });

    it('should parse failed resource validation', () => {
      const line = '{"level":"info","msg":"azurerm_storage_account.example: failed","time":"2024-09-17T10:30:00Z"}';
      parser.parseLine(line);
      
      const results = parser.getResourceResults();
      expect(results).to.have.length(1);
      expect(results[0]).to.deep.equal({
        resource: 'azurerm_storage_account.example',
        status: 'failed'
      });
    });

    it('should parse multiple resource results', () => {
      const output = `{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T10:30:00Z"}
{"level":"info","msg":"azurerm_storage_account.example: failed","time":"2024-09-17T10:30:01Z"}
{"level":"info","msg":"azurerm_virtual_network.main: success","time":"2024-09-17T10:30:02Z"}`;
      
      parser.parseOutput(output);
      
      const results = parser.getResourceResults();
      expect(results).to.have.length(3);
      expect(results[0].status).to.equal('success');
      expect(results[1].status).to.equal('failed');
      expect(results[2].status).to.equal('success');
    });

    it('should handle resource names with spaces and special characters', () => {
      const line = '{"level":"info","msg":"module.networking.azurerm_resource_group.main[0]: success","time":"2024-09-17T10:30:00Z"}';
      parser.parseLine(line);
      
      const results = parser.getResourceResults();
      expect(results).to.have.length(1);
      expect(results[0].resource).to.equal('module.networking.azurerm_resource_group.main[0]');
    });
  });

  describe('Summary Parsing', () => {
    it('should calculate summary from resource results', () => {
      const output = `{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T10:30:00Z"}
{"level":"info","msg":"azurerm_storage_account.example: success","time":"2024-09-17T10:30:01Z"}
{"level":"info","msg":"azurerm_virtual_network.main: success","time":"2024-09-17T10:30:02Z"}
{"level":"info","msg":"azurerm_subnet.internal: success","time":"2024-09-17T10:30:03Z"}`;
      
      parser.parseOutput(output);
      
      const summary = parser.getSummary();
      expect(summary.totalResources).to.equal(4);
      expect(summary.successfulResources).to.equal(4);
      expect(summary.failedResources).to.equal(0);
    });

    it('should calculate summary with failures from resource results', () => {
      const output = `{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T10:30:00Z"}
{"level":"info","msg":"azurerm_storage_account.example: failed","time":"2024-09-17T10:30:01Z"}
{"level":"info","msg":"azurerm_virtual_network.main: success","time":"2024-09-17T10:30:02Z"}`;
      
      parser.parseOutput(output);
      
      const summary = parser.getSummary();
      expect(summary.totalResources).to.equal(3);
      expect(summary.successfulResources).to.equal(2);
      expect(summary.failedResources).to.equal(1);
    });

    it('should handle empty resource results', () => {
      const line = '{"level":"info","msg":"Starting validation process","time":"2024-09-17T10:30:00Z"}';
      parser.parseLine(line);
      
      const summary = parser.getSummary();
      expect(summary.totalResources).to.equal(0);
      expect(summary.successfulResources).to.equal(0);
      expect(summary.failedResources).to.equal(0);
    });

    it('should parse preflight errors count', () => {
      const line = '{"level":"info","msg":"preflight errors: 2","time":"2024-09-17T10:30:00Z"}';
      const result = parser.parseLine(line);
      
      expect(result).to.be.true;
      // Preflight errors count doesn't affect summary (counted from actual error entries)
    });
  });

  describe('Error Handling', () => {
    it('should parse error entries', () => {
      const line = '{"level":"error","msg":"validation failed for resource azurerm_storage_account.example","time":"2024-09-17T10:30:00Z"}';
      parser.parseLine(line);
      
      const errors = parser.getErrors();
      expect(errors).to.have.length(1);
      expect(errors[0]).to.deep.include({
        level: 'error',
        message: 'validation failed for resource azurerm_storage_account.example',
        time: '2024-09-17T10:30:00Z'
      });
    });

    it('should indicate if there are errors', () => {
      expect(parser.hasErrors()).to.be.false;
      
      const line = '{"level":"error","msg":"test error","time":"2024-09-17T10:30:00Z"}';
      parser.parseLine(line);
      
      expect(parser.hasErrors()).to.be.true;
    });

    it('should treat fatal level as error', () => {
      const line = '{"level":"fatal","msg":"failed to show plan file: exit status 1\\n","time":"2025-09-17T09:29:40+08:00"}';
      parser.parseLine(line);
      
      const errors = parser.getErrors();
      expect(errors).to.have.length(1);
      expect(errors[0]).to.deep.include({
        level: 'error',
        message: 'failed to show plan file: exit status 1\n',
        time: '2025-09-17T09:29:40+08:00'
      });
      expect(parser.hasErrors()).to.be.true;
    });
  });

  describe('Complete Summary', () => {
    it('should provide complete summary with all parsed data', () => {
      const output = `{"level":"info","msg":"Starting validation","time":"2024-09-17T10:30:00Z"}
{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T10:30:01Z"}
{"level":"info","msg":"azurerm_storage_account.example: failed","time":"2024-09-17T10:30:02Z"}
{"level":"error","msg":"validation failed for azurerm_storage_account.example","time":"2024-09-17T10:30:03Z"}
{"level":"info","msg":"total terraform resources: 2, success: 1, failed: 1","time":"2024-09-17T10:30:04Z"}
{"level":"info","msg":"preflight errors: 1","time":"2024-09-17T10:30:05Z"}`;
      
      parser.parseOutput(output);
      
      const summary = parser.getSummary();
      expect(summary.totalResources).to.equal(2);
      expect(summary.successfulResources).to.equal(1);
      expect(summary.failedResources).to.equal(1);
      expect(summary.errors).to.have.length(1);
      expect(summary.resourceResults).to.have.length(2);
      
      expect(summary.resourceResults[0]).to.deep.equal({
        resource: 'azurerm_resource_group.main',
        status: 'success'
      });
      expect(summary.resourceResults[1]).to.deep.equal({
        resource: 'azurerm_storage_account.example',
        status: 'failed'
      });
    });
  });

  describe('Parser State Management', () => {
    it('should reset parser state', () => {
      // Add some data
      const output = `{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T10:30:01Z"}
{"level":"error","msg":"validation failed","time":"2024-09-17T10:30:02Z"}
{"level":"info","msg":"total terraform resources: 1, success: 1, failed: 0","time":"2024-09-17T10:30:03Z"}`;
      
      parser.parseOutput(output);
      
      expect(parser.getEntries()).to.have.length(3);
      expect(parser.getErrors()).to.have.length(1);
      expect(parser.getResourceResults()).to.have.length(1);
      expect(parser.hasErrors()).to.be.true;
      
      // Reset and verify clean state
      parser.reset();
      
      expect(parser.getEntries()).to.have.length(0);
      expect(parser.getErrors()).to.have.length(0);
      expect(parser.getResourceResults()).to.have.length(0);
      expect(parser.hasErrors()).to.be.false;
      
      const summary = parser.getSummary();
      expect(summary.totalResources).to.equal(0);
      expect(summary.successfulResources).to.equal(0);
      expect(summary.failedResources).to.equal(0);
    });

    it('should return copies of arrays to prevent external modification', () => {
      const line = '{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T10:30:01Z"}';
      parser.parseLine(line);
      
      const entries1 = parser.getEntries();
      const entries2 = parser.getEntries();
      
      // Should be equal but not the same reference
      expect(entries1).to.deep.equal(entries2);
      expect(entries1).to.not.equal(entries2);
      
      // Modifying returned array shouldn't affect parser state
      entries1.pop();
      expect(parser.getEntries()).to.have.length(1);
    });
  });

  describe('Message Cleaning', () => {
    it('should clean newlines from messages when processing', () => {
      const line = '{"level":"info","msg":"azurerm_resource_group.main\\n: success","time":"2024-09-17T10:30:00Z"}';
      parser.parseLine(line);
      
      const results = parser.getResourceResults();
      expect(results).to.have.length(1);
      expect(results[0].resource).to.equal('azurerm_resource_group.main');
    });

    it('should preserve original message in error entries', () => {
      const originalMsg = 'validation failed with details';
      const line = `{"level":"error","msg":"${originalMsg}","time":"2024-09-17T10:30:00Z"}`;
      parser.parseLine(line);
      
      const errors = parser.getErrors();
      expect(errors).to.have.length(1);
      expect(errors[0].message).to.equal(originalMsg);
    });
  });

  describe('Utility Functions', () => {
    it('createPreflightLogParser should create new parser instance', () => {
      const newParser = createPreflightLogParser();
      expect(newParser).to.be.instanceof(PreflightLogParser);
      expect(newParser.getEntries()).to.have.length(0);
    });

    it('parsePreflightOutput should parse and return summary', () => {
      const output = `{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T10:30:01Z"}
{"level":"info","msg":"total terraform resources: 1, success: 1, failed: 0","time":"2024-09-17T10:30:02Z"}`;
      
      const summary = parsePreflightOutput(output);
      
      expect(summary.totalResources).to.equal(1);
      expect(summary.successfulResources).to.equal(1);
      expect(summary.failedResources).to.equal(0);
      expect(summary.resourceResults).to.have.length(1);
      expect(summary.errors).to.have.length(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle realistic aztfpreflight output', () => {
      const realOutput = `{"level":"info","msg":"2024-09-17T12:41:47.917+08:00 [INFO]  terraform validate...","time":"2024-09-17T04:41:47Z"}
{"level":"info","msg":"2024-09-17T12:41:47.922+08:00 [INFO]  init terraform...","time":"2024-09-17T04:41:47Z"}
{"level":"info","msg":"2024-09-17T12:41:49.303+08:00 [INFO]  azurerm_resource_group.main: success","time":"2024-09-17T04:41:49Z"}
{"level":"info","msg":"2024-09-17T12:41:50.123+08:00 [INFO]  azurerm_storage_account.example: success","time":"2024-09-17T04:41:50Z"}
{"level":"info","msg":"2024-09-17T12:41:50.456+08:00 [INFO]  azurerm_virtual_network.main: success","time":"2024-09-17T04:41:50Z"}
{"level":"info","msg":"2024-09-17T12:41:50.789+08:00 [INFO]  azurerm_subnet.internal: success","time":"2024-09-17T04:41:50Z"}
{"level":"info","msg":"2024-09-17T12:41:51.123+08:00 [INFO]  total terraform resources: 4, success: 4, failed: 0","time":"2024-09-17T04:41:51Z"}
{"level":"info","msg":"2024-09-17T12:41:51.124+08:00 [INFO]  preflight errors: 0","time":"2024-09-17T04:41:51Z"}`;
      
      parser.parseOutput(realOutput);
      
      const summary = parser.getSummary();
      expect(summary.totalResources).to.equal(4);
      expect(summary.successfulResources).to.equal(4);
      expect(summary.failedResources).to.equal(0);
      expect(summary.resourceResults).to.have.length(4);
      expect(summary.errors).to.have.length(0);
      expect(parser.hasErrors()).to.be.false;
      
      const expectedResources = [
        'azurerm_resource_group.main',
        'azurerm_storage_account.example',
        'azurerm_virtual_network.main',
        'azurerm_subnet.internal'
      ];
      
      summary.resourceResults.forEach((result, index) => {
        expect(result.resource).to.equal(expectedResources[index]);
        expect(result.status).to.equal('success');
      });
    });

    it('should handle output with errors and mixed results', () => {
      const errorOutput = `{"level":"info","msg":"azurerm_resource_group.main: success","time":"2024-09-17T04:41:49Z"}
{"level":"info","msg":"azurerm_storage_account.invalid: failed","time":"2024-09-17T04:41:50Z"}
{"level":"error","msg":"validation failed for azurerm_storage_account.invalid with correlation id: 'abc-123' for POST https://management.azure.com/subscriptions/test","time":"2024-09-17T04:41:50Z"}
{"level":"info","msg":"total terraform resources: 2, success: 1, failed: 1","time":"2024-09-17T04:41:51Z"}
{"level":"info","msg":"preflight errors: 1","time":"2024-09-17T04:41:51Z"}`;
      
      parser.parseOutput(errorOutput);
      
      const summary = parser.getSummary();
      expect(summary.totalResources).to.equal(2);
      expect(summary.successfulResources).to.equal(1);
      expect(summary.failedResources).to.equal(1);
      expect(summary.resourceResults).to.have.length(2);
      expect(summary.errors).to.have.length(1);
      expect(parser.hasErrors()).to.be.true;
      
      expect(summary.resourceResults[0].status).to.equal('success');
      expect(summary.resourceResults[1].status).to.equal('failed');
    });
  });
});