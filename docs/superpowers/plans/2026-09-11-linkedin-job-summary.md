# LinkedIn Job Summary Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 browser extension that injects a summary card above every LinkedIn job description, listing required skills, preferred skills, years of experience, and education, extracted locally with no network calls.

**Architecture:** A content script watches the LinkedIn job details pane with a `MutationObserver`, reads the description text out of the DOM, and hands it to a pure extractor module that returns a summary object. A render module turns that object into a card element injected above the description. All extraction logic is DOM-free and unit tested under Node; the DOM glue is thin and verified manually in Edge.

**Tech Stack:** Vanilla JavaScript (no build step, no bundler, no dependencies), Chrome Manifest V3, Node 22 built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-09-11-linkedin-job-summary-design.md`

---

## Module Interop Pattern

There is no bundler. The same source files must load as classic content scripts in the browser
AND be `require`-able from Node tests. Every file in `src/` therefore uses this wrapper:

```js
(function (root) {
  'use strict';

  // ... module body ...

  root.LJS_THING = theThing;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { theThing };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

In the browser, content scripts declared in `manifest.json` share one isolated-world global
object, so `root.LJS_*` is how modules find each other. In Node, `globalThis` plays the same
role, and `module.exports` additionally makes `require()` ergonomic. Load order matters in
both places: `skills.js`, then `extractor.js`, then `card.js`, then `content.js`.

## File Structure

| File | Responsibility |
|---|---|
| `manifest.json` | MV3 declaration. One `content_scripts` entry matching LinkedIn job URLs. No `permissions` key at all. |
| `src/skills.js` | Data only. The canonical skill dictionary: `LJS_SKILLS`, an array of `{ name, aliases?, pattern? }`. No logic. |
| `src/extractor.js` | Pure text analysis. Exports `splitSections`, `extractSkills`, `extractYears`, `extractEducation`, `extract`. Never touches the DOM. |
| `src/card.js` | Pure rendering. Exports `render(summary)` and `renderError(message)`, both returning a detached `HTMLElement`. Uses DOM APIs but reads nothing from the live page. |
| `src/card.css` | Card styles, every rule scoped under `.ljs-card`. |
| `src/content.js` | The only file that touches LinkedIn's DOM. Description lookup, job id resolution, mutation observing, injection. No extraction logic. |
| `test/extractor.test.js` | Unit tests for every extractor function. |
| `test/fixtures/*.txt` | Real-shaped job descriptions used as test input. |
| `icons/` | 16, 48, and 128 pixel PNGs. |
| `README.md` | Install instructions for Edge and a statement of known limits. |

---

### Task 1: Project scaffolding and manifest

**Files:**
- Create: `manifest.json`
- Create: `src/card.css`
- Create: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
- Create: `.gitignore`

- [ ] **Step 1: Create the manifest**

Create `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "LinkedIn Job Summary",
  "version": "1.0.0",
  "description": "Shows required skills, years of experience, and education above every LinkedIn job description.",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/jobs/*"],
      "js": ["src/skills.js", "src/extractor.js", "src/card.js", "src/content.js"],
      "css": ["src/card.css"],
      "run_at": "document_idle"
    }
  ]
}
```

There is deliberately no `permissions` and no `host_permissions` key. A `content_scripts`
match is sufficient and keeps the install prompt minimal.

- [ ] **Step 2: Create the icons**

Run this to generate three solid placeholder PNGs with no external tooling:

```bash
python3 - <<'PY'
import struct, zlib, pathlib

def png(size, rgb):
    raw = b''.join(b'\x00' + bytes(rgb) * size for _ in range(size))
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw))
            + chunk(b'IEND', b''))

pathlib.Path('icons').mkdir(exist_ok=True)
for s in (16, 48, 128):
    pathlib.Path(f'icons/icon{s}.png').write_bytes(png(s, (10, 102, 194)))
print('icons written')
PY
```

Expected output: `icons written`

- [ ] **Step 3: Create the stylesheet**

Create `src/card.css`:

```css
.ljs-card {
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  padding: 12px 14px;
  margin: 12px 0 16px 0;
  background: #f8fafc;
  font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2328;
}

.ljs-card__title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #0a66c2;
  margin-bottom: 8px;
}

.ljs-card__row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-top: 6px;
}

.ljs-card__label {
  flex: 0 0 96px;
  font-weight: 600;
  color: #4a5568;
}

.ljs-card__value {
  flex: 1 1 auto;
}

.ljs-card__tag {
  display: inline-block;
  padding: 1px 8px;
  margin: 2px 4px 2px 0;
  border-radius: 10px;
  background: #e6edf7;
  border: 1px solid #c9d8ec;
  font-size: 13px;
  white-space: nowrap;
}

.ljs-card__tag--preferred {
  background: #f1f3f5;
  border-color: #dde1e6;
  color: #5a6470;
}

.ljs-card__tag-years {
  color: #0a66c2;
  font-weight: 600;
}

.ljs-card--error {
  background: #fff8e6;
  border-color: #e8d9a8;
  color: #6b5b1f;
}
```

- [ ] **Step 4: Create .gitignore**

Create `.gitignore`:

```
node_modules/
.DS_Store
*.zip
```

- [ ] **Step 5: Verify the manifest parses**

Run: `python3 -c "import json;json.load(open('manifest.json'));print('manifest ok')"`
Expected: `manifest ok`

- [ ] **Step 6: Commit**

```bash
git add manifest.json src/card.css icons .gitignore
git commit -m "feat: scaffold MV3 extension manifest, styles, and icons"
```

---

### Task 2: Skill dictionary

**Files:**
- Create: `src/skills.js`
- Test: `test/skills.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/skills.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { SKILLS } = require('../src/skills.js');

test('dictionary is large enough to be useful', () => {
  assert.ok(SKILLS.length >= 300, `expected >= 300 skills, got ${SKILLS.length}`);
});

test('every entry has a name and no duplicate names', () => {
  const seen = new Set();
  for (const s of SKILLS) {
    assert.equal(typeof s.name, 'string', 'name must be a string');
    assert.ok(s.name.length > 0, 'name must not be empty');
    assert.ok(!seen.has(s.name.toLowerCase()), `duplicate skill: ${s.name}`);
    seen.add(s.name.toLowerCase());
  }
});

test('aliases, when present, are a non-empty array of strings', () => {
  for (const s of SKILLS) {
    if (s.aliases === undefined) continue;
    assert.ok(Array.isArray(s.aliases), `${s.name} aliases must be an array`);
    assert.ok(s.aliases.length > 0, `${s.name} aliases must not be empty`);
    for (const a of s.aliases) assert.equal(typeof a, 'string');
  }
});

test('ambiguous and overlapping names carry an explicit pattern', () => {
  const ambiguous = ['Go', 'R', 'C', 'C++', 'C#', '.NET', 'React', 'Spring', 'SQL'];
  for (const name of ambiguous) {
    const entry = SKILLS.find((s) => s.name === name);
    assert.ok(entry, `missing dictionary entry for ${name}`);
    assert.ok(entry.pattern instanceof RegExp, `${name} must define a pattern`);
  }
});

test('the dictionary sets a global for browser load order', () => {
  assert.ok(Array.isArray(globalThis.LJS_SKILLS), 'LJS_SKILLS global not set');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skills.test.js`
Expected: FAIL with `Cannot find module '../src/skills.js'`

- [ ] **Step 3: Write the dictionary**

Create `src/skills.js`. Entries are `{ name }` by default. Add `aliases` only where a
posting realistically uses a different token. Add `pattern` only for names too short or too
ambiguous for a plain word-boundary match.

```js
(function (root) {
  'use strict';

  const SKILLS = [
    // --- Languages ---
    { name: 'JavaScript', aliases: ['js', 'ecmascript'] },
    { name: 'TypeScript', aliases: ['ts'] },
    { name: 'Python' },
    { name: 'Java' },
    { name: 'C', pattern: /(?<![A-Za-z+#.])C(?![A-Za-z+#])/ },
    { name: 'C++', pattern: /C\+\+/ },
    { name: 'C#', pattern: /C#/ },
    { name: 'Go', pattern: /(?<![A-Za-z])Go(?:lang)?(?![a-z])/ },
    { name: 'Rust' },
    { name: 'Ruby' },
    { name: 'PHP' },
    { name: 'Swift' },
    { name: 'Kotlin' },
    { name: 'Scala' },
    { name: 'Perl' },
    { name: 'R', pattern: /(?<![A-Za-z.])R(?:\s*[,/;)]|\s+(?:and|or|programming|language|scripts?|packages?|shiny)\b)/ },
    { name: 'MATLAB' },
    { name: 'Objective-C' },
    { name: 'Dart' },
    { name: 'Elixir' },
    { name: 'Erlang' },
    { name: 'Haskell' },
    { name: 'Clojure' },
    { name: 'Groovy' },
    { name: 'Lua' },
    { name: 'Shell scripting', aliases: ['shell script', 'shell scripts'] },
    { name: 'Bash' },
    { name: 'PowerShell' },
    { name: 'VBA' },
    { name: 'COBOL' },
    { name: 'Fortran' },
    { name: 'Assembly' },
    { name: 'Solidity' },
    { name: 'Julia' },
    { name: 'F#', pattern: /F#/ },
    { name: 'Visual Basic' },
    { name: 'Delphi' },
    { name: 'Apex' },
    { name: 'ABAP' },
    { name: 'SAS' },
    { name: 'SPSS' },
    { name: 'Stata' },

    // --- Front end ---
    { name: 'HTML', aliases: ['html5'] },
    { name: 'CSS', aliases: ['css3'] },
    { name: 'Sass', aliases: ['scss'] },
    { name: 'Less' },
    { name: 'Tailwind CSS', aliases: ['tailwind'] },
    { name: 'Bootstrap' },
    { name: 'React', pattern: /(?<![A-Za-z0-9])React(?:\.js|js)?(?!\s*Native)(?![A-Za-z0-9])/i },
    { name: 'Angular', aliases: ['angularjs'] },
    { name: 'Vue.js', aliases: ['vue', 'vuejs'] },
    { name: 'Svelte', aliases: ['sveltekit'] },
    { name: 'Next.js', aliases: ['nextjs'] },
    { name: 'Nuxt.js', aliases: ['nuxt'] },
    { name: 'Remix' },
    { name: 'Ember.js', aliases: ['ember'] },
    { name: 'Backbone.js', aliases: ['backbone'] },
    { name: 'jQuery' },
    { name: 'Redux' },
    { name: 'MobX' },
    { name: 'RxJS' },
    { name: 'Webpack' },
    { name: 'Vite' },
    { name: 'Babel' },
    { name: 'ESLint' },
    { name: 'Storybook' },
    { name: 'Three.js', aliases: ['threejs'] },
    { name: 'D3.js', aliases: ['d3'] },
    { name: 'WebGL' },
    { name: 'WebAssembly', aliases: ['wasm'] },
    { name: 'Web Components' },
    { name: 'Material UI', aliases: ['mui'] },
    { name: 'Chakra UI' },
    { name: 'Figma' },
    { name: 'Accessibility', aliases: ['wcag', 'a11y', 'section 508'] },
    { name: 'Responsive design' },

    // --- Mobile ---
    { name: 'React Native' },
    { name: 'Flutter' },
    { name: 'SwiftUI' },
    { name: 'UIKit' },
    { name: 'Android SDK', aliases: ['android development'] },
    { name: 'Jetpack Compose' },
    { name: 'Xamarin' },
    { name: 'Ionic' },
    { name: 'Cordova' },
    { name: 'iOS development', aliases: ['ios'] },

    // --- Backend and frameworks ---
    { name: 'Node.js', aliases: ['node', 'nodejs'] },
    { name: 'Express.js', aliases: ['express', 'expressjs'] },
    { name: 'NestJS', aliases: ['nest.js'] },
    { name: 'Deno' },
    { name: 'Spring', pattern: /(?<![A-Za-z0-9])Spring(?!\s*Boot)(?![A-Za-z0-9])/i },
    { name: 'Spring Boot' },
    { name: 'Hibernate' },
    { name: 'JPA' },
    { name: 'Jakarta EE', aliases: ['java ee', 'j2ee'] },
    { name: 'Micronaut' },
    { name: 'Quarkus' },
    { name: 'Django' },
    { name: 'Flask' },
    { name: 'FastAPI' },
    { name: 'Ruby on Rails', aliases: ['rails'] },
    { name: 'Sinatra' },
    { name: 'Laravel' },
    { name: 'Symfony' },
    { name: 'CodeIgniter' },
    { name: 'ASP.NET', aliases: ['asp.net core'] },
    { name: '.NET', pattern: /\.NET(?!\s*Core)\b/i },
    { name: '.NET Core', pattern: /\.NET\s*Core\b/i },
    { name: 'Entity Framework' },
    { name: 'Gin' },
    { name: 'Phoenix' },
    { name: 'Play Framework' },
    { name: 'Akka' },
    { name: 'Netty' },
    { name: 'gRPC' },
    { name: 'GraphQL' },
    { name: 'REST APIs', aliases: ['rest', 'restful', 'rest api'] },
    { name: 'SOAP' },
    { name: 'OpenAPI', aliases: ['swagger'] },
    { name: 'WebSockets', aliases: ['websocket'] },
    { name: 'Protocol Buffers', aliases: ['protobuf'] },
    { name: 'Thrift' },

    // --- Databases ---
    { name: 'SQL', pattern: /(?<![A-Za-z0-9])SQL(?!\s*Server)(?![A-Za-z0-9])/i },
    { name: 'MySQL' },
    { name: 'PostgreSQL', aliases: ['postgres'] },
    { name: 'SQL Server', aliases: ['mssql', 't-sql', 'tsql'] },
    { name: 'Oracle Database', aliases: ['oracle', 'pl/sql', 'plsql'] },
    { name: 'SQLite' },
    { name: 'MariaDB' },
    { name: 'MongoDB', aliases: ['mongo'] },
    { name: 'Cassandra' },
    { name: 'DynamoDB' },
    { name: 'Redis' },
    { name: 'Memcached' },
    { name: 'Elasticsearch', aliases: ['elastic search'] },
    { name: 'OpenSearch' },
    { name: 'Solr' },
    { name: 'Neo4j' },
    { name: 'CouchDB' },
    { name: 'Firestore' },
    { name: 'Firebase' },
    { name: 'Snowflake' },
    { name: 'Redshift' },
    { name: 'BigQuery' },
    { name: 'Databricks' },
    { name: 'Teradata' },
    { name: 'Vertica' },
    { name: 'ClickHouse' },
    { name: 'InfluxDB' },
    { name: 'TimescaleDB' },
    { name: 'Cosmos DB', aliases: ['cosmosdb'] },
    { name: 'HBase' },
    { name: 'Pinecone' },
    { name: 'Weaviate' },
    { name: 'pgvector' },
    { name: 'Database design', aliases: ['data modeling', 'schema design'] },
    { name: 'Query optimization' },

    // --- Cloud ---
    { name: 'AWS', aliases: ['amazon web services'] },
    { name: 'Azure', aliases: ['microsoft azure'] },
    { name: 'Google Cloud', aliases: ['gcp', 'google cloud platform'] },
    { name: 'EC2' },
    { name: 'S3' },
    { name: 'AWS Lambda', aliases: ['lambda'] },
    { name: 'ECS' },
    { name: 'EKS' },
    { name: 'Fargate' },
    { name: 'CloudFormation' },
    { name: 'CloudWatch' },
    { name: 'API Gateway' },
    { name: 'SQS' },
    { name: 'SNS' },
    { name: 'Step Functions' },
    { name: 'IAM' },
    { name: 'RDS' },
    { name: 'Azure Functions' },
    { name: 'Azure DevOps' },
    { name: 'GKE' },
    { name: 'Cloud Run' },
    { name: 'Heroku' },
    { name: 'DigitalOcean' },
    { name: 'Cloudflare' },
    { name: 'Vercel' },
    { name: 'Netlify' },
    { name: 'OpenStack' },
    { name: 'VMware' },
    { name: 'Cloud architecture' },
    { name: 'Cost optimization', aliases: ['finops'] },

    // --- DevOps and platform ---
    { name: 'Docker' },
    { name: 'Kubernetes', aliases: ['k8s'] },
    { name: 'Helm' },
    { name: 'Terraform' },
    { name: 'Pulumi' },
    { name: 'Ansible' },
    { name: 'Chef' },
    { name: 'Puppet' },
    { name: 'Vagrant' },
    { name: 'Jenkins' },
    { name: 'GitHub Actions' },
    { name: 'GitLab CI', aliases: ['gitlab ci/cd'] },
    { name: 'CircleCI' },
    { name: 'Travis CI' },
    { name: 'TeamCity' },
    { name: 'Bamboo' },
    { name: 'Argo CD', aliases: ['argocd'] },
    { name: 'Flux' },
    { name: 'Spinnaker' },
    { name: 'Nginx' },
    { name: 'Apache HTTP Server', aliases: ['apache httpd'] },
    { name: 'HAProxy' },
    { name: 'Istio' },
    { name: 'Envoy' },
    { name: 'Consul' },
    { name: 'Vault' },
    { name: 'Prometheus' },
    { name: 'Grafana' },
    { name: 'Datadog' },
    { name: 'New Relic' },
    { name: 'Splunk' },
    { name: 'ELK Stack', aliases: ['elk'] },
    { name: 'Logstash' },
    { name: 'Kibana' },
    { name: 'PagerDuty' },
    { name: 'Sentry' },
    { name: 'OpenTelemetry' },
    { name: 'Jaeger' },
    { name: 'CI/CD', aliases: ['continuous integration', 'continuous delivery', 'continuous deployment'] },
    { name: 'Infrastructure as Code', aliases: ['iac'] },
    { name: 'Site Reliability Engineering', aliases: ['sre'] },
    { name: 'Linux' },
    { name: 'Unix' },
    { name: 'Windows Server' },
    { name: 'Git' },
    { name: 'GitHub' },
    { name: 'GitLab' },
    { name: 'Bitbucket' },
    { name: 'Subversion', aliases: ['svn'] },
    { name: 'Maven' },
    { name: 'Gradle' },
    { name: 'npm' },
    { name: 'Yarn' },
    { name: 'pnpm' },
    { name: 'pip' },
    { name: 'Poetry' },
    { name: 'Bazel' },
    { name: 'Make', aliases: ['makefile'] },
    { name: 'Networking', aliases: ['tcp/ip', 'dns', 'load balancing'] },

    // --- Data and machine learning ---
    { name: 'Kafka', aliases: ['apache kafka'] },
    { name: 'RabbitMQ' },
    { name: 'ActiveMQ' },
    { name: 'Pulsar' },
    { name: 'Kinesis' },
    { name: 'Flink' },
    { name: 'Spark', aliases: ['apache spark', 'pyspark'] },
    { name: 'Hadoop' },
    { name: 'Hive' },
    { name: 'MapReduce' },
    { name: 'Airflow', aliases: ['apache airflow'] },
    { name: 'Dagster' },
    { name: 'Prefect' },
    { name: 'dbt' },
    { name: 'NiFi' },
    { name: 'Informatica' },
    { name: 'Talend' },
    { name: 'SSIS' },
    { name: 'Pandas' },
    { name: 'NumPy' },
    { name: 'SciPy' },
    { name: 'scikit-learn', aliases: ['sklearn', 'scikit learn'] },
    { name: 'TensorFlow' },
    { name: 'PyTorch' },
    { name: 'Keras' },
    { name: 'XGBoost' },
    { name: 'LightGBM' },
    { name: 'Hugging Face', aliases: ['huggingface', 'transformers'] },
    { name: 'LangChain' },
    { name: 'OpenCV' },
    { name: 'NLTK' },
    { name: 'spaCy' },
    { name: 'MLflow' },
    { name: 'Kubeflow' },
    { name: 'SageMaker' },
    { name: 'Tableau' },
    { name: 'Power BI', aliases: ['powerbi'] },
    { name: 'Looker' },
    { name: 'Qlik', aliases: ['qlikview'] },
    { name: 'Superset' },
    { name: 'Jupyter' },
    { name: 'ETL', aliases: ['elt'] },
    { name: 'Data warehousing', aliases: ['data warehouse'] },
    { name: 'Data pipelines', aliases: ['data pipeline'] },
    { name: 'Machine learning', aliases: ['ml'] },
    { name: 'Deep learning' },
    { name: 'NLP', aliases: ['natural language processing'] },
    { name: 'Computer vision' },
    { name: 'LLMs', aliases: ['llm', 'large language model', 'large language models'] },
    { name: 'RAG', aliases: ['retrieval augmented generation', 'retrieval-augmented generation'] },
    { name: 'Generative AI', aliases: ['gen ai', 'genai'] },
    { name: 'Reinforcement learning' },
    { name: 'Statistics', aliases: ['statistical analysis'] },
    { name: 'A/B testing', aliases: ['ab testing', 'experimentation'] },
    { name: 'Data analysis', aliases: ['data analytics'] },
    { name: 'Feature engineering' },
    { name: 'Model deployment', aliases: ['mlops'] },

    // --- Testing and quality ---
    { name: 'JUnit' },
    { name: 'TestNG' },
    { name: 'Mockito' },
    { name: 'pytest' },
    { name: 'Jest' },
    { name: 'Mocha' },
    { name: 'Jasmine' },
    { name: 'Vitest' },
    { name: 'Cypress' },
    { name: 'Playwright' },
    { name: 'Selenium' },
    { name: 'Puppeteer' },
    { name: 'Appium' },
    { name: 'Cucumber' },
    { name: 'Postman' },
    { name: 'JMeter' },
    { name: 'LoadRunner' },
    { name: 'SonarQube' },
    { name: 'TDD', aliases: ['test driven development', 'test-driven development'] },
    { name: 'BDD', aliases: ['behavior driven development'] },
    { name: 'Unit testing' },
    { name: 'Integration testing' },
    { name: 'Performance testing', aliases: ['load testing'] },
    { name: 'Test automation', aliases: ['automated testing'] },

    // --- Security and identity ---
    { name: 'OAuth', aliases: ['oauth2', 'oauth 2.0'] },
    { name: 'SAML' },
    { name: 'OpenID Connect', aliases: ['oidc'] },
    { name: 'JWT' },
    { name: 'SSO', aliases: ['single sign-on', 'single sign on'] },
    { name: 'LDAP' },
    { name: 'Active Directory' },
    { name: 'Kerberos' },
    { name: 'TLS', aliases: ['ssl'] },
    { name: 'PKI' },
    { name: 'Penetration testing', aliases: ['pen testing'] },
    { name: 'OWASP' },
    { name: 'SIEM' },
    { name: 'Zero Trust' },
    { name: 'Encryption', aliases: ['cryptography'] },
    { name: 'Okta' },
    { name: 'Auth0' },
    { name: 'Keycloak' },
    { name: 'Threat modeling' },
    { name: 'SOC 2', aliases: ['soc2'] },
    { name: 'HIPAA' },
    { name: 'GDPR' },
    { name: 'PCI DSS', aliases: ['pci-dss'] },

    // --- Architecture and practice ---
    { name: 'Agile' },
    { name: 'Scrum' },
    { name: 'Kanban' },
    { name: 'SAFe' },
    { name: 'Waterfall' },
    { name: 'Jira' },
    { name: 'Confluence' },
    { name: 'Microservices' },
    { name: 'Event-driven architecture', aliases: ['event driven'] },
    { name: 'Domain-driven design', aliases: ['ddd', 'domain driven design'] },
    { name: 'Design patterns' },
    { name: 'System design' },
    { name: 'Distributed systems' },
    { name: 'Serverless' },
    { name: 'Multithreading', aliases: ['concurrency', 'concurrent programming'] },
    { name: 'Data structures' },
    { name: 'Algorithms' },
    { name: 'Object-oriented programming', aliases: ['oop', 'object oriented'] },
    { name: 'Functional programming' },
    { name: 'Code review' },
    { name: 'Technical writing', aliases: ['documentation'] },
    { name: 'Mentoring' },
    { name: 'Stakeholder management' },
    { name: 'Cross-functional collaboration' },

    // --- Enterprise platforms ---
    { name: 'Salesforce' },
    { name: 'SAP' },
    { name: 'ServiceNow' },
    { name: 'Workday' },
    { name: 'PeopleSoft' },
    { name: 'NetSuite' },
    { name: 'Shopify' },
    { name: 'WordPress' },
    { name: 'Drupal' },
    { name: 'Sitecore' },
    { name: 'Adobe Experience Manager', aliases: ['aem'] },
    { name: 'Contentful' },
    { name: 'Twilio' },
    { name: 'Stripe' },
    { name: 'Segment' },
    { name: 'Snowplow' },
    { name: 'Excel' },
    { name: 'SharePoint' },
    { name: 'Microsoft Dynamics', aliases: ['dynamics 365'] },
    { name: 'Mulesoft' },
    { name: 'Boomi' },
    { name: 'Apigee' },
    { name: 'Kong' },
    { name: 'Camunda' }
  ];

  root.LJS_SKILLS = SKILLS;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SKILLS };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/skills.test.js`
Expected: PASS, 5 tests. If the count assertion fails, add entries in the categories above
until the dictionary reaches 300; do not lower the threshold.

- [ ] **Step 5: Commit**

```bash
git add src/skills.js test/skills.test.js
git commit -m "feat: add canonical skill dictionary"
```

---
### Task 3: Sectioning the description

Splits the description into blocks and labels each `required`, `preferred`, or `other`.
This is the foundation every later extractor builds on.

**Files:**
- Create: `src/extractor.js`
- Test: `test/extractor.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/extractor.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/skills.js');
const { splitSections } = require('../src/extractor.js');

const typesOf = (secs) => secs.map((s) => s.type);
const sectionText = (secs, type) =>
  secs.filter((s) => s.type === type).map((s) => s.text).join('\n');

test('a colon heading starts a new section', () => {
  const secs = splitSections(
    'We build payments infrastructure.\n' +
    'Requirements:\n' +
    'Strong Java skills.\n' +
    'Preferred Qualifications:\n' +
    'Exposure to Kafka.'
  );
  assert.ok(typesOf(secs).includes('required'));
  assert.ok(typesOf(secs).includes('preferred'));
  assert.match(sectionText(secs, 'required'), /Strong Java skills/);
  assert.match(sectionText(secs, 'preferred'), /Kafka/);
});

test('preferred wins over required when a heading contains both words', () => {
  const secs = splitSections('Preferred Qualifications:\nNice extras here.');
  assert.deepEqual(typesOf(secs), ['preferred']);
});

test('boilerplate headings are labelled other', () => {
  const secs = splitSections(
    'Requirements:\nPython and SQL.\nBenefits:\nFree lunch and a 401k match.'
  );
  assert.ok(typesOf(secs).includes('other'));
  assert.match(sectionText(secs, 'other'), /Free lunch/);
});

test('"About the job" is not treated as boilerplate', () => {
  const secs = splitSections('About the job\nYou will build APIs in Go.');
  assert.ok(!typesOf(secs).includes('other'));
});

test('text with no headings defaults to required', () => {
  const secs = splitSections('You will write Python every day and own the pipeline.');
  assert.deepEqual(typesOf(secs), ['required']);
});

test('bullet lines are never treated as headings', () => {
  const secs = splitSections('Requirements:\n- Experience with React\n- Experience with Node.js');
  assert.equal(secs.length, 1);
  assert.equal(secs[0].type, 'required');
});

test('empty input produces no sections', () => {
  assert.deepEqual(splitSections(''), []);
  assert.deepEqual(splitSections(null), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/extractor.test.js`
Expected: FAIL with `Cannot find module '../src/extractor.js'`

- [ ] **Step 3: Write the implementation**

Create `src/extractor.js`:

```js
(function (root) {
  'use strict';

  // Ordered: preferred is checked before required, because "Preferred
  // Qualifications" contains "qualifications" and must not be read as required.
  const HEADING_RULES = [
    {
      type: 'preferred',
      re: /\b(preferred|nice[-\s]to[-\s]have|bonus|desired|desirable|good to have|pluses|extra credit)\b/i
    },
    {
      type: 'other',
      re: /\b(about (us|the company|the team)|who we are|benefits|perks|compensation|pay range|salary|equal opportunit|eeo|diversity|our mission|why join|how to apply|accommodation|disclaimer|next steps)\b/i
    },
    {
      type: 'required',
      re: /\b(requirements?|qualifications?|must[-\s]have|what you(?:.{0,10})(?:bring|need)|you have|your background|skills|experience|responsibilit|who you are|what you.{0,5}ll do)\b/i
    }
  ];

  function classifyHeading(line) {
    for (const rule of HEADING_RULES) {
      if (rule.re.test(line)) return rule.type;
    }
    return null;
  }

  function isHeadingLine(line) {
    const t = line.trim();
    if (t.length < 2 || t.length > 90) return false;
    if (/^[-•*•●\d]/.test(t)) return false; // bullets and numbered items
    if (t.split(/\s+/).length > 10) return false;
    if (t.endsWith(':')) return true;
    if (t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
    return classifyHeading(t) !== null && !/[.!?]$/.test(t);
  }

  function splitSections(text) {
    const lines = String(text == null ? '' : text).split(/\r?\n/);
    const blocks = [];
    let current = { type: 'required', lines: [] };

    for (const line of lines) {
      if (isHeadingLine(line)) {
        const type = classifyHeading(line);
        if (type) {
          if (current.lines.join('').trim()) blocks.push(current);
          current = { type: type, lines: [] };
          continue; // the heading itself is not body text
        }
      }
      current.lines.push(line);
    }
    if (current.lines.join('').trim()) blocks.push(current);

    return blocks
      .map((b) => ({ type: b.type, text: b.lines.join('\n').trim() }))
      .filter((b) => b.text.length > 0);
  }

  root.LJSExtractor = { splitSections: splitSections };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LJSExtractor;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/extractor.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extractor.js test/extractor.test.js
git commit -m "feat: split job descriptions into required, preferred, and boilerplate sections"
```

---

### Task 4: Skill extraction

**Files:**
- Modify: `src/extractor.js`
- Test: `test/extractor.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/extractor.test.js`:

```js
const { extractSkills, usableSections } = require('../src/extractor.js');

const skillsFor = (text) => extractSkills(usableSections(splitSections(text)));

test('skills under Requirements land in required', () => {
  const out = skillsFor('Requirements:\nStrong Java and Spring Boot experience on AWS.');
  assert.deepEqual(out.required, ['Java', 'Spring Boot', 'AWS']);
  assert.deepEqual(out.preferred, []);
});

test('skills under Preferred land in preferred', () => {
  const out = skillsFor('Requirements:\nJava.\nNice to Have:\nKafka and gRPC.');
  assert.deepEqual(out.required, ['Java']);
  assert.deepEqual(out.preferred, ['Kafka', 'gRPC']);
});

test('a skill in both groups is reported as required only', () => {
  const out = skillsFor('Nice to Have:\nRedis.\nRequirements:\nRedis and SQL.');
  assert.ok(out.required.includes('Redis'));
  assert.ok(!out.preferred.includes('Redis'));
});

test('a line saying "a plus" overrides its required section', () => {
  const out = skillsFor('Requirements:\nPython is required.\nTerraform is a plus.');
  assert.ok(out.required.includes('Python'));
  assert.ok(out.preferred.includes('Terraform'));
});

test('Java does not match inside JavaScript', () => {
  const out = skillsFor('Requirements:\nJavaScript and TypeScript.');
  assert.ok(!out.required.includes('Java'));
  assert.ok(out.required.includes('JavaScript'));
});

test('Go matches Golang but not Google', () => {
  assert.ok(skillsFor('Requirements:\nWe use Golang.').required.includes('Go'));
  assert.ok(!skillsFor('Requirements:\nWe are a Google Cloud shop.').required.includes('Go'));
});

test('C does not match C++ or C#', () => {
  const out = skillsFor('Requirements:\nC++ and C# only.');
  assert.ok(!out.required.includes('C'));
  assert.ok(out.required.includes('C++'));
  assert.ok(out.required.includes('C#'));
});

test('aliases resolve to the canonical name', () => {
  const out = skillsFor('Requirements:\nk8s, postgres, and gcp.');
  assert.ok(out.required.includes('Kubernetes'));
  assert.ok(out.required.includes('PostgreSQL'));
  assert.ok(out.required.includes('Google Cloud'));
});

test('each group is capped at twelve entries', () => {
  const many = 'Requirements:\n' + [
    'Java', 'Python', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala',
    'Perl', 'Elixir', 'Haskell', 'Clojure', 'Groovy', 'Lua'
  ].join(', ') + '.';
  assert.equal(skillsFor(many).required.length, 12);
});

test('Spring is not double-reported inside Spring Boot', () => {
  const out = skillsFor('Requirements:\nStrong Spring Boot and Kubernetes experience in production.');
  assert.ok(out.required.includes('Spring Boot'));
  assert.ok(!out.required.includes('Spring'));
});

test('boilerplate sections do not contribute skills', () => {
  const out = skillsFor(
    'Requirements:\nStrong Java and Spring Boot experience, with Kubernetes and AWS in production.\n' +
    'Benefits:\nWe use Slack and offer Excel training.'
  );
  assert.ok(!out.required.includes('Excel'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/extractor.test.js`
Expected: FAIL with `extractSkills is not a function`

- [ ] **Step 3: Write the implementation**

In `src/extractor.js`, insert the following immediately before the
`root.LJSExtractor = ...` line:

```js
  const PREFERRED_LINE_RE =
    /\b(preferred|nice[-\s]to[-\s]have|a plus|bonus|desirable|ideally|would be (?:great|nice)|familiarity with)\b/i;

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  let matcherCache = null;

  function getMatchers() {
    if (matcherCache) return matcherCache;
    const skills = root.LJS_SKILLS || [];
    matcherCache = skills.map((skill) => {
      if (skill.pattern) return { name: skill.name, re: skill.pattern };
      const terms = [skill.name].concat(skill.aliases || []);
      const alt = terms
        .slice()
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join('|');
      return {
        name: skill.name,
        re: new RegExp('(?<![A-Za-z0-9])(?:' + alt + ')(?![A-Za-z0-9])', 'i')
      };
    });
    return matcherCache;
  }

  // Boilerplate is dropped only when real content survives. A posting whose whole
  // body sits under a single "About us" heading would otherwise yield nothing.
  function usableSections(sections) {
    const useful = sections.filter((s) => s.type !== 'other');
    const hasSubstance = useful.some((s) => s.text.length >= 80);
    if (hasSubstance) return useful;
    return sections.map((s) => ({
      type: s.type === 'other' ? 'required' : s.type,
      text: s.text
    }));
  }

  const MAX_PER_GROUP = 12;

  function extractSkills(sections) {
    const matchers = getMatchers();
    const found = new Map();
    let order = 0;

    for (const section of sections) {
      for (const line of section.text.split(/\r?\n/)) {
        const lineGroup =
          PREFERRED_LINE_RE.test(line) || section.type === 'preferred'
            ? 'preferred'
            : 'required';
        for (const matcher of matchers) {
          if (!matcher.re.test(line)) continue;
          const prev = found.get(matcher.name);
          if (!prev) {
            found.set(matcher.name, { name: matcher.name, group: lineGroup, order: order });
          } else if (prev.group === 'preferred' && lineGroup === 'required') {
            prev.group = 'required';
          }
        }
        order += 1;
      }
    }

    const all = Array.from(found.values()).sort((a, b) => a.order - b.order);
    return {
      required: all.filter((s) => s.group === 'required').slice(0, MAX_PER_GROUP).map((s) => s.name),
      preferred: all.filter((s) => s.group === 'preferred').slice(0, MAX_PER_GROUP).map((s) => s.name)
    };
  }
```

Then change the export line to:

```js
  root.LJSExtractor = {
    splitSections: splitSections,
    usableSections: usableSections,
    extractSkills: extractSkills
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/extractor.test.js`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extractor.js test/extractor.test.js
git commit -m "feat: extract required and preferred skills from job sections"
```

---
### Task 5: Years of experience

**Files:**
- Modify: `src/extractor.js`
- Test: `test/extractor.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/extractor.test.js` (add `extractYears` to the existing require):

```js
const { extractYears } = require('../src/extractor.js');

const yearsFor = (text) => extractYears(usableSections(splitSections(text)));

test('a plain "5+ years" becomes the headline', () => {
  const out = yearsFor('Requirements:\n5+ years of professional software engineering experience.');
  assert.equal(out.headline.label, '5+ years');
  assert.equal(out.headline.min, 5);
  assert.equal(out.headline.max, null);
});

test('a range is reported as a range', () => {
  const out = yearsFor('Requirements:\n3-5 years of relevant experience.');
  assert.equal(out.headline.label, '3-5 years');
  assert.equal(out.headline.min, 3);
  assert.equal(out.headline.max, 5);
});

test('"at least two years" is understood', () => {
  const out = yearsFor('Requirements:\nAt least two years of industry experience.');
  assert.equal(out.headline.label, '2+ years');
});

test('"minimum of 7 years" is understood', () => {
  const out = yearsFor('Requirements:\nA minimum of 7 years of engineering experience.');
  assert.equal(out.headline.label, '7+ years');
});

test('technology-specific years do not become the headline', () => {
  const out = yearsFor(
    'Requirements:\n' +
    '7+ years of professional software engineering experience.\n' +
    '3+ years of Python.'
  );
  assert.equal(out.headline.label, '7+ years');
  assert.equal(out.perSkill.Python, 3);
});

test('technology-specific years are recorded per skill', () => {
  const out = yearsFor('Requirements:\n4+ years working with Kubernetes in production.');
  assert.equal(out.perSkill.Kubernetes, 4);
});

test('a required-section number outranks a preferred-section number', () => {
  const out = yearsFor(
    'Preferred:\n10 years of experience leading teams.\n' +
    'Requirements:\n4+ years of professional experience.'
  );
  assert.equal(out.headline.label, '4+ years');
});

test('a posting with no numbers yields no headline', () => {
  const out = yearsFor('Requirements:\nDeep experience with Java and strong communication skills.');
  assert.equal(out.headline, null);
  assert.deepEqual(out.perSkill, {});
});

test('unrelated numbers are not mistaken for years', () => {
  const out = yearsFor('Benefits:\nWe offer a 401k match and 20 days of leave.\nRequirements:\nJava.');
  assert.equal(out.headline, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/extractor.test.js`
Expected: FAIL with `extractYears is not a function`

- [ ] **Step 3: Write the implementation**

In `src/extractor.js`, insert before the `root.LJSExtractor = ...` line:

```js
  const NUM_WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15
  };
  const NUM = '\\d{1,2}|' + Object.keys(NUM_WORDS).join('|');

  const YEARS_RE = new RegExp(
    '(at least|minimum(?:\\s+of)?|min\\.?|no less than|over|more than)?\\s*' +
      '(' + NUM + ')' +
      '\\s*(?:(\\+|plus)|(?:\\s*(?:-|–|—|to)\\s*(' + NUM + ')))?' +
      '\\s*\\+?\\s*(?:years?|yrs?)\\b',
    'gi'
  );

  const EXPERIENCE_NEARBY_RE = /\b(experience|background|track record)\b/i;
  const GENERAL_EXPERIENCE_RE =
    /\b(professional|industry|relevant|overall|software|engineering|work|hands[-\s]on|combined)\s+experience\b|\byears?\s+of\s+experience\b/i;

  function toNumber(token) {
    if (token == null) return null;
    const t = String(token).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NUM_WORDS, t)) return NUM_WORDS[t];
    const n = parseInt(t, 10);
    return Number.isNaN(n) ? null : n;
  }

  function yearsLabel(min, max, plus) {
    if (max != null) return min + '-' + max + ' years';
    if (plus) return min + '+ years';
    return min + (min === 1 ? ' year' : ' years');
  }

  function extractYears(sections) {
    const matchers = getMatchers();
    const candidates = [];
    const perSkill = {};
    let lineIndex = 0;

    // The context window is one line, never the whole section. A wider window
    // lets a skill on the next bullet capture the headline number, so
    // "7+ years of experience" followed by "3+ years of Python" would be read
    // as Python-specific and the job would show no overall bar.
    for (const section of sections) {
      for (const line of section.text.split(/\r?\n/)) {
        YEARS_RE.lastIndex = 0;
        let m;
        while ((m = YEARS_RE.exec(line)) !== null) {
          const min = toNumber(m[2]);
          if (min == null || min > 40) continue;
          const max = toNumber(m[4]);
          const plus = Boolean(m[3]) || Boolean(m[1]);

          let namedSkill = null;
          for (const matcher of matchers) {
            if (matcher.re.test(line)) {
              namedSkill = matcher.name;
              break;
            }
          }

          if (namedSkill) {
            if (perSkill[namedSkill] == null) perSkill[namedSkill] = min;
            continue; // technology-specific, never the headline
          }
          if (!EXPERIENCE_NEARBY_RE.test(line)) continue; // "20 days", "401k" and friends

          candidates.push({
            min: min,
            max: max,
            label: yearsLabel(min, max, plus),
            score:
              (section.type === 'required' ? 2 : 0) +
              (GENERAL_EXPERIENCE_RE.test(line) ? 2 : 0),
            order: lineIndex * 1000 + m.index
          });
        }
        lineIndex += 1;
      }
    }

    candidates.sort((a, b) => (b.score - a.score) || (a.order - b.order));
    const best = candidates[0] || null;

    return {
      headline: best ? { label: best.label, min: best.min, max: best.max } : null,
      perSkill: perSkill
    };
  }
```

Add `extractYears: extractYears,` to the `root.LJSExtractor` object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/extractor.test.js`
Expected: PASS, 27 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extractor.js test/extractor.test.js
git commit -m "feat: extract headline and per-skill years of experience"
```

---

### Task 6: Education requirement

**Files:**
- Modify: `src/extractor.js`
- Test: `test/extractor.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/extractor.test.js` (add `extractEducation` to the existing require):

```js
const { extractEducation } = require('../src/extractor.js');

const eduFor = (text) => extractEducation(usableSections(splitSections(text)));

test('a bachelor degree with a field is captured', () => {
  const out = eduFor("Requirements:\nBachelor's degree in Computer Science.");
  assert.equal(out.level, "Bachelor's");
  assert.equal(out.field, 'Computer Science');
});

test('abbreviations are recognised', () => {
  assert.equal(eduFor('Requirements:\nBS in Electrical Engineering required.').level, "Bachelor's");
  assert.equal(eduFor('Requirements:\nPh.D. preferred for this role.').level, 'PhD');
});

test('the lowest stated level is reported as the bar', () => {
  const out = eduFor(
    "Requirements:\nMaster's degree in Statistics, or a Bachelor's degree in a related field."
  );
  assert.equal(out.level, "Bachelor's");
});

test('equivalent experience is flagged', () => {
  const out = eduFor("Requirements:\nBachelor's degree in CS or equivalent practical experience.");
  assert.equal(out.equivalentOk, true);
});

test('no equivalency phrase means the flag is false', () => {
  const out = eduFor("Requirements:\nBachelor's degree in Computer Science is required.");
  assert.equal(out.equivalentOk, false);
});

test('a degree with no field still reports the level', () => {
  const out = eduFor("Requirements:\nBachelor's degree required.");
  assert.equal(out.level, "Bachelor's");
  assert.equal(out.field, null);
});

test('"MS SQL Server" is not mistaken for a master degree', () => {
  assert.equal(eduFor('Requirements:\nExperience with MS SQL Server and reporting.'), null);
});

test('"may be required" is not mistaken for a B.E. degree', () => {
  assert.equal(eduFor('Requirements:\nTravel may be required for this role.'), null);
});

test('a posting with no education requirement returns null', () => {
  assert.equal(eduFor('Requirements:\nStrong Java and Kubernetes skills.'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/extractor.test.js`
Expected: FAIL with `extractEducation is not a function`

- [ ] **Step 3: Write the implementation**

In `src/extractor.js`, insert before the `root.LJSExtractor = ...` line:

```js
  const EDU_FIELD = '(?:\\s+(?:in|of)\\s+([A-Za-z][A-Za-z ,/&-]{1,60}?))?';
  const EDU_TAIL = '(?=[.,;:)\\n]|\\s+(?:or|and|with|is|are|required|preferred|from|plus)\\b|$)';

  // Spelled-out levels are safe to match case-insensitively.
  const EDU_WORD_RE = new RegExp(
    "\\b(associate(?:'s|s)?|bachelor(?:'s|s)?|master(?:'s|s)?|mba|ph\\.?\\s?d\\.?|doctorate|doctoral)\\b" +
      '(?:\\s+degree)?' + EDU_FIELD + EDU_TAIL,
    'gi'
  );

  // Abbreviations must be matched case-sensitively. Case-insensitively, "B.E."
  // also matches the ordinary word "be", so "travel may be required" would be
  // reported as a bachelor degree.
  const EDU_ABBR_RE = new RegExp(
    '\\b(B\\.?S\\.?c?|B\\.?A\\.?|B\\.?E\\.?|B\\.?Tech|M\\.?S\\.?c?|M\\.?A\\.?|M\\.?Eng|M\\.?Tech)\\b' +
      '(?:\\s+degree)?' + EDU_FIELD + EDU_TAIL,
    'g'
  );

  const EQUIVALENT_RE =
    /or\s+equivalent(?:\s+(?:practical\s+|relevant\s+|work\s+)?(?:experience|training|qualification)s?)?/i;

  const LEVEL_RANK = { "Associate's": 1, "Bachelor's": 2, "Master's": 3, PhD: 4 };

  function normalizeLevel(token) {
    const t = token.toLowerCase().replace(/[.\s']/g, '');
    if (/^assoc/.test(t)) return "Associate's";
    if (/^(bachelors?|bsc?|ba|be|btech)$/.test(t)) return "Bachelor's";
    if (/^(masters?|msc?|ma|meng|mtech|mba)$/.test(t)) return "Master's";
    if (/^(phd|doctorate|doctoral)$/.test(t)) return 'PhD';
    return null;
  }

  function cleanField(raw) {
    if (!raw) return null;
    const field = raw
      .replace(/\s+/g, ' ')
      .replace(/\s+(?:or|and)$/i, '')
      .replace(/[,\s]+$/, '')
      .trim();
    if (field.length < 2) return null;
    // Title-case a field that arrived shouting, leave normal casing alone.
    return field === field.toUpperCase() && field.length > 3
      ? field.charAt(0) + field.slice(1).toLowerCase()
      : field;
  }

  function extractEducation(sections) {
    const hits = [];

    for (const section of sections) {
      const text = section.text;
      for (const re of [EDU_WORD_RE, EDU_ABBR_RE]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
          const level = normalizeLevel(m[1]);
          if (!level) continue;
          const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 100);
          hits.push({
            level: level,
            rank: LEVEL_RANK[level],
            field: cleanField(m[2]),
            equivalentOk: EQUIVALENT_RE.test(tail),
            required: section.type === 'required'
          });
        }
      }
    }

    if (hits.length === 0) return null;

    // The bar is the lowest acceptable degree, and a required section beats a
    // preferred one when both name a degree.
    const pool = hits.some((h) => h.required) ? hits.filter((h) => h.required) : hits;
    pool.sort((a, b) => a.rank - b.rank);
    const best = pool[0];

    return {
      level: best.level,
      field: best.field,
      equivalentOk: hits.some((h) => h.level === best.level && h.equivalentOk)
    };
  }
```

Add `extractEducation: extractEducation,` to the `root.LJSExtractor` object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/extractor.test.js`
Expected: PASS, 36 tests.

- [ ] **Step 5: Commit**

```bash
git add src/extractor.js test/extractor.test.js
git commit -m "feat: extract education requirement and equivalency"
```

---
### Task 7: Assemble the summary and test against real postings

**Files:**
- Modify: `src/extractor.js`
- Create: `test/fixtures/structured.txt`
- Create: `test/fixtures/vague-prose.txt`
- Create: `test/fixtures/preferred-heavy.txt`
- Create: `test/fixtures/no-years.txt`
- Create: `test/fixtures/tech-specific-years.txt`
- Test: `test/fixtures.test.js`

- [ ] **Step 1: Create the fixtures**

Run each heredoc from the repository root.

```bash
mkdir -p test/fixtures

cat > test/fixtures/structured.txt <<'EOF'
About the job

We are building the payments platform that powers thousands of businesses.
This role sits on the core services team.

What You'll Do
- Design and ship backend services that move money reliably.
- Partner with product and design on new merchant features.

Requirements
- 5+ years of professional software engineering experience.
- Strong proficiency in Java and Spring Boot.
- Production experience with Kubernetes and AWS.
- Solid working knowledge of PostgreSQL and query optimization.
- Bachelor's degree in Computer Science or equivalent practical experience.

Preferred Qualifications
- Exposure to Kafka and event-driven architecture.
- Experience with gRPC and Protocol Buffers.
- Familiarity with Terraform.

Benefits
- Competitive salary, 401k match, and 20 days of paid leave.
- We are an equal opportunity employer.
EOF

cat > test/fixtures/vague-prose.txt <<'EOF'
About the job

We are a small team looking for someone who can own features end to end.
You will write Python every day, work in Django on the API side, and build
the front end in React. We care more about how you think than about a list
of buzzwords, but you should bring at least 3 years of relevant experience
and be comfortable owning a service in production. Our stack runs on AWS
and we deploy with Docker several times a day.
EOF

cat > test/fixtures/preferred-heavy.txt <<'EOF'
About the job

Join our analytics team as a Business Analyst supporting the revenue org.

Minimum Qualifications
- 2+ years of professional experience in an analytical role.
- Strong SQL skills and advanced Excel.

Nice to Have
- Tableau or Power BI dashboard development.
- Python for ad hoc analysis.
- Snowflake or another cloud data warehouse.
- dbt and data modeling experience.
- Exposure to A/B testing and experimentation.
EOF

cat > test/fixtures/no-years.txt <<'EOF'
About the job

We are hiring a platform engineer to help us scale.

Requirements
- Deep hands on experience with Terraform and Kubernetes.
- Comfortable operating services on Google Cloud.
- Strong Go fundamentals and a bias toward automation.
- Track record of improving CI/CD pipelines.

Preferred
- Prometheus and Grafana for observability.
EOF

cat > test/fixtures/tech-specific-years.txt <<'EOF'
About the job

Senior Machine Learning Engineer, Ranking.

Basic Qualifications
- 7+ years of professional software engineering experience.
- 3+ years of Python in a production setting.
- 2 years of PyTorch or TensorFlow.
- Master's degree in Computer Science, Statistics, or a related field.

Preferred Qualifications
- Publications in applied machine learning.
- Experience with Spark and Airflow.
EOF

echo "fixtures written"
```

Expected output: `fixtures written`

- [ ] **Step 2: Write the failing test**

Create `test/fixtures.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
require('../src/skills.js');
const { extract } = require('../src/extractor.js');

const load = (name) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name + '.txt'), 'utf8');
const summarize = (name) => extract(load(name));
const names = (list) => list.map((s) => s.name);

test('structured posting: headline years, both skill groups, education', () => {
  const s = summarize('structured');
  assert.equal(s.years.label, '5+ years');
  for (const skill of ['Java', 'Spring Boot', 'Kubernetes', 'AWS', 'PostgreSQL']) {
    assert.ok(names(s.skillsRequired).includes(skill), 'missing required ' + skill);
  }
  for (const skill of ['Kafka', 'gRPC', 'Terraform']) {
    assert.ok(names(s.skillsPreferred).includes(skill), 'missing preferred ' + skill);
  }
  assert.equal(s.education.level, "Bachelor's");
  assert.equal(s.education.field, 'Computer Science');
  assert.equal(s.education.equivalentOk, true);
  assert.equal(s.empty, false);
});

test('structured posting: benefits boilerplate leaks nothing', () => {
  const s = summarize('structured');
  assert.ok(!names(s.skillsRequired).includes('Excel'));
  assert.notEqual(s.years.label, '20 years');
});

test('vague prose with no headings still yields skills and years', () => {
  const s = summarize('vague-prose');
  assert.equal(s.years.label, '3+ years');
  for (const skill of ['Python', 'Django', 'React', 'AWS', 'Docker']) {
    assert.ok(names(s.skillsRequired).includes(skill), 'missing ' + skill);
  }
  assert.equal(s.education, null);
});

test('preferred-heavy posting keeps the groups apart', () => {
  const s = summarize('preferred-heavy');
  assert.equal(s.years.label, '2+ years');
  assert.ok(names(s.skillsRequired).includes('SQL'));
  assert.ok(names(s.skillsRequired).includes('Excel'));
  for (const skill of ['Tableau', 'Power BI', 'Python', 'Snowflake', 'dbt']) {
    assert.ok(names(s.skillsPreferred).includes(skill), 'missing preferred ' + skill);
  }
  assert.ok(!names(s.skillsRequired).includes('Tableau'));
});

test('a posting with no numbers shows no years rather than guessing', () => {
  const s = summarize('no-years');
  assert.equal(s.years, null);
  assert.ok(names(s.skillsRequired).includes('Terraform'));
  assert.ok(names(s.skillsRequired).includes('Kubernetes'));
  assert.ok(names(s.skillsPreferred).includes('Prometheus'));
  assert.equal(s.empty, false);
});

test('technology years qualify their skill, not the headline', () => {
  const s = summarize('tech-specific-years');
  assert.equal(s.years.label, '7+ years');
  const python = s.skillsRequired.find((x) => x.name === 'Python');
  assert.ok(python, 'Python missing from required');
  assert.equal(python.years, 3);
  assert.equal(s.education.level, "Master's");
});

test('an unreadable blob summarises as empty rather than throwing', () => {
  const s = extract('   \n\n   ');
  assert.equal(s.empty, true);
  assert.equal(s.years, null);
  assert.deepEqual(s.skillsRequired, []);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/fixtures.test.js`
Expected: FAIL with `extract is not a function`

- [ ] **Step 4: Write the implementation**

In `src/extractor.js`, insert before the `root.LJSExtractor = ...` line:

```js
  function withYears(names, perSkill) {
    return names.map((name) => ({
      name: name,
      years: Object.prototype.hasOwnProperty.call(perSkill, name) ? perSkill[name] : null
    }));
  }

  function extract(text) {
    const sections = usableSections(splitSections(text));
    const skills = extractSkills(sections);
    const years = extractYears(sections);
    const education = extractEducation(sections);

    const skillsRequired = withYears(skills.required, years.perSkill);
    const skillsPreferred = withYears(skills.preferred, years.perSkill);

    return {
      years: years.headline,
      skillsRequired: skillsRequired,
      skillsPreferred: skillsPreferred,
      education: education,
      empty:
        years.headline === null &&
        skillsRequired.length === 0 &&
        skillsPreferred.length === 0 &&
        education === null
    };
  }
```

Add `extract: extract,` to the `root.LJSExtractor` object. The final export block is:

```js
  root.LJSExtractor = {
    splitSections: splitSections,
    usableSections: usableSections,
    extractSkills: extractSkills,
    extractYears: extractYears,
    extractEducation: extractEducation,
    extract: extract
  };
```

- [ ] **Step 5: Run the whole suite**

Run: `node --test test/*.test.js`
Expected: PASS, all 48 tests across three files.

If a fixture assertion fails, fix the extractor, not the fixture. The fixtures represent
how postings are actually written and are the contract.

- [ ] **Step 6: Add a test script and commit**

Create `package.json`:

```json
{
  "name": "linkedin-job-summary",
  "version": "1.0.0",
  "private": true,
  "description": "Edge extension that summarises LinkedIn job postings",
  "scripts": {
    "test": "node --test test/*.test.js"
  }
}
```

```bash
npm test
git add src/extractor.js test/ package.json
git commit -m "feat: assemble job summary and verify against real postings"
```

Expected from `npm test`: all tests pass.

---

### Task 8: Render the card

**Files:**
- Create: `src/card.js`
- Test: verified through Task 9's manual check (DOM rendering, no unit test)

- [ ] **Step 1: Write the implementation**

Create `src/card.js`:

```js
(function (root) {
  'use strict';

  const doc = root.document;

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function tagList(skills, preferred) {
    const wrap = el('span');
    for (const skill of skills) {
      const tag = el('span', 'ljs-card__tag' + (preferred ? ' ljs-card__tag--preferred' : ''));
      tag.appendChild(doc.createTextNode(skill.name));
      if (skill.years != null) {
        const yrs = el('span', 'ljs-card__tag-years', ' ' + skill.years + '+y');
        tag.appendChild(yrs);
      }
      wrap.appendChild(tag);
    }
    return wrap;
  }

  function row(parent, label, valueNode) {
    const r = el('div', 'ljs-card__row');
    r.appendChild(el('span', 'ljs-card__label', label));
    const value = el('span', 'ljs-card__value');
    value.appendChild(valueNode);
    r.appendChild(value);
    parent.appendChild(r);
  }

  function educationText(edu) {
    let text = edu.level;
    if (edu.field) text += ' in ' + edu.field;
    if (edu.equivalentOk) text += ' (or equivalent experience)';
    return text;
  }

  function shell(extraClass) {
    const card = el('div', 'ljs-card' + (extraClass ? ' ' + extraClass : ''));
    card.setAttribute('data-ljs-card', 'true');
    card.appendChild(el('div', 'ljs-card__title', 'Quick summary'));
    return card;
  }

  function render(summary) {
    if (!summary || summary.empty) {
      return renderError('No skills or experience requirements found in this posting.');
    }
    const card = shell(null);
    if (summary.years) {
      row(card, 'Experience', doc.createTextNode(summary.years.label));
    }
    if (summary.skillsRequired.length) {
      row(card, 'Required', tagList(summary.skillsRequired, false));
    }
    if (summary.skillsPreferred.length) {
      row(card, 'Preferred', tagList(summary.skillsPreferred, true));
    }
    if (summary.education) {
      row(card, 'Education', doc.createTextNode(educationText(summary.education)));
    }
    return card;
  }

  function renderError(message) {
    const card = shell('ljs-card--error');
    row(card, 'Status', doc.createTextNode(message));
    return card;
  }

  root.LJSCard = { render: render, renderError: renderError };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.LJSCard;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

Every value goes in through `textContent` or `createTextNode`. There is no `innerHTML`
anywhere, so job description text can never execute as markup.

- [ ] **Step 2: Commit**

```bash
git add src/card.js
git commit -m "feat: render the summary card"
```

---

### Task 9: Page integration

**Files:**
- Create: `src/content.js`

- [ ] **Step 1: Write the implementation**

Create `src/content.js`:

```js
(function (root) {
  'use strict';

  const doc = root.document;
  const CARD_ATTR = 'data-ljs-card';

  // Tried in order. LinkedIn renames classes without notice, so this is layered
  // rather than a single selector.
  const DESCRIPTION_SELECTORS = [
    '.jobs-description__content',
    '#job-details',
    '.jobs-box__html-content',
    '.show-more-less-html__markup',
    '.jobs-description-content__text'
  ];

  const PANE_SELECTORS = [
    '.jobs-search__job-details',
    '.job-view-layout',
    '.jobs-details',
    'main'
  ];

  function firstMatch(selectors) {
    for (const selector of selectors) {
      const node = doc.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  // Last resort: the biggest text block inside the details pane.
  function largestTextBlock(pane) {
    if (!pane) return null;
    let best = null;
    let bestLength = 400; // below this it is chrome, not a description
    const candidates = pane.querySelectorAll('div, section, article');
    for (const node of candidates) {
      if (node.querySelector('[' + CARD_ATTR + ']')) continue;
      const length = (node.innerText || '').trim().length;
      if (length > bestLength) {
        bestLength = length;
        best = node;
      }
    }
    return best;
  }

  function findDescription() {
    return firstMatch(DESCRIPTION_SELECTORS) || largestTextBlock(firstMatch(PANE_SELECTORS));
  }

  function hashOf(text) {
    let h = 0;
    const sample = text.slice(0, 200);
    for (let i = 0; i < sample.length; i += 1) {
      h = (h * 31 + sample.charCodeAt(i)) | 0;
    }
    return 'h' + h;
  }

  function jobKey(descriptionText) {
    const params = new URLSearchParams(root.location.search);
    const current = params.get('currentJobId');
    if (current) return 'id' + current;
    const viewMatch = root.location.pathname.match(/\/jobs\/view\/(\d+)/);
    if (viewMatch) return 'id' + viewMatch[1];
    return hashOf(descriptionText);
  }

  let lastKey = null;

  function update() {
    const description = findDescription();

    if (!description) {
      lastKey = null;
      return;
    }

    const text = description.innerText || '';
    if (text.trim().length < 40) return; // pane still loading

    const key = jobKey(text);
    const existing = doc.querySelector('[' + CARD_ATTR + ']');
    if (key === lastKey && existing) return;

    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    let card;
    try {
      card = root.LJSCard.render(root.LJSExtractor.extract(text));
    } catch (err) {
      card = root.LJSCard.renderError('Could not read this posting.');
    }

    const anchor = description.parentNode ? description : null;
    if (!anchor || !anchor.parentNode) return;
    anchor.parentNode.insertBefore(card, anchor);
    lastKey = key;
  }

  let pending = null;
  function schedule() {
    if (pending) return;
    pending = root.setTimeout(function () {
      pending = null;
      update();
    }, 250);
  }

  const observer = new root.MutationObserver(schedule);
  observer.observe(doc.body, { childList: true, subtree: true });

  // LinkedIn is a single page app; history moves do not always mutate immediately.
  root.addEventListener('popstate', schedule);
  schedule();
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

The 250 millisecond debounce matters. LinkedIn mutates the DOM constantly, and an
undebounced observer would re-render the card dozens of times per click.

- [ ] **Step 2: Verify the syntax of every source file**

Run: `node --check src/skills.js && node --check src/extractor.js && node --check src/card.js && node --check src/content.js && echo "syntax ok"`
Expected: `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add src/content.js
git commit -m "feat: observe the LinkedIn job pane and inject the card"
```

---

### Task 10: Manual verification in Edge and README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Load the extension**

1. Open Edge and go to `edge://extensions`.
2. Turn on "Developer mode" in the left sidebar.
3. Click "Load unpacked" and choose the repository folder.
4. Confirm the extension appears with no errors listed under it.

- [ ] **Step 2: Verify on the search layout**

1. Go to `https://www.linkedin.com/jobs/` and run any search.
2. Confirm a "Quick summary" card appears above the description of the selected job.
3. Click three different jobs in the list. Confirm the card updates each time and that no
   duplicate cards stack up.
4. Open a job whose posting states no years. Confirm the Experience row is absent rather
   than showing a wrong number.

- [ ] **Step 3: Verify on the standalone job page**

1. Open any job by its direct URL, the `linkedin.com/jobs/view/...` form.
2. Confirm the card renders there too.

- [ ] **Step 4: Check the console**

1. Open DevTools on the jobs page and look at the Console.
2. Confirm there are no errors mentioning the extension files.

- [ ] **Step 5: Write the README**

Create `README.md`:

```markdown
# LinkedIn Job Summary

A browser extension that puts a summary card above every LinkedIn job description, so you
can see the required skills, the years of experience, and the education bar without
scrolling the posting.

## Install in Edge

1. Open `edge://extensions`.
2. Turn on Developer mode.
3. Click "Load unpacked" and select this folder.

The same folder loads in Chrome through `chrome://extensions` with the same steps.

## What it reads and sends

It reads the text of the job description on pages under `https://www.linkedin.com/jobs/`.
It sends nothing anywhere. There is no API key, no account, no server, and no analytics.
The manifest declares no permissions beyond that one content script match, so the extension
cannot see any other site.

## How it decides

Skills come from a dictionary of over 300 technologies and practices, matched against the
posting text. A skill found under a Preferred or Nice to Have heading, or on a line saying
"a plus", is listed as preferred; everything else is listed as required.

Years of experience come from phrases like "5+ years" and "at least three years". A number
sitting next to a specific technology qualifies that technology instead of becoming the
headline, so "3 years of Python" shows as a tag on Python and does not become the job's bar.

Education comes from degree phrases, and the lowest level stated is reported, because that
is the actual bar.

## Known limits

- Skills outside the dictionary are missed. Treat the card as a fast filter, not a
  replacement for reading a posting you actually like.
- A posting that never states a number shows no Experience row. The extension does not guess.
- LinkedIn can change its markup. If that happens the card says so rather than silently
  disappearing.

## Tests

    npm test

Runs the extractor unit tests and the fixture postings under Node. No dependencies.
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: add install instructions and known limits"
```

---

## Done when

- `npm test` passes with no failures.
- The card renders on both the LinkedIn search layout and a standalone job page.
- Clicking between jobs replaces the card rather than stacking duplicates.
- A posting with no stated years shows no Experience row.
- The browser console shows no errors from the extension.
