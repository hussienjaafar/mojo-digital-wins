# News & Trends System Audit Agents

A comprehensive audit system for the News & Trends V2 overhaul, based on industry best practices for algorithm auditing, ML system quality assurance, and recommendation system fairness.

## Research-Based Audit Methodology

Based on extensive research from:
- [ACM FAccT 2025 - Auditing Political Exposure Bias](https://dl.acm.org/doi/10.1145/3715275.3732159)
- [ACM Transactions on Recommender Systems - YouTube Misinformation Audits](https://dl.acm.org/doi/10.1145/3568392)
- [ISACA - AI Algorithm Audits Key Control Considerations](https://www.isaca.org/resources/news-and-trends/industry-news/2024/ai-algorithm-audits-key-control-considerations)
- [BABL AI - Algorithm Auditor Certification](https://courses.babl.ai/p/ai-and-algorithm-auditor-certification)
- [ML-Architects - Testing & QA for ML Pipelines](https://ml-architects.ch/blog_posts/testing_and_quality_assurance.html)
- [Auditing Algorithms - Auditability Checklist](https://www.auditingalgorithms.net/AuditabilityChecklist.html)

## Audit Team Roles (Research-Derived)

### 1. Data Pipeline Quality Auditor
**Role:** Data Engineer / QA Specialist
**Skills:** SQL, data validation, schema design, ETL testing
**Focus Areas:**
- Data ingestion accuracy
- Deduplication effectiveness
- Schema integrity
- Data freshness checks

### 2. Filter Bubble & Diversity Auditor
**Role:** Algorithm Auditor / Fairness Researcher
**Skills:** Statistics, recommendation systems, bias detection
**Focus Areas:**
- Inter-user diversity metrics (KL divergence, Jensen-Shannon)
- Calibration by policy domains
- Echo chamber detection
- Exploration vs. exploitation balance

### 3. Algorithm Fairness Auditor
**Role:** AI Ethics Specialist
**Skills:** Fairness metrics, bias detection, causal inference
**Focus Areas:**
- Scoring algorithm bias detection
- Demographic fairness (if applicable)
- Outcome equity across organization types
- Transparency of scoring decisions

### 4. Domain Coverage Auditor
**Role:** Domain Expert / Political Analyst
**Skills:** Political science, policy analysis, keyword taxonomy
**Focus Areas:**
- Policy domain keyword completeness
- Missing topic coverage
- Entity recognition accuracy
- Geographic tagging accuracy

### 5. Security & Compliance Auditor
**Role:** Security Analyst / Compliance Officer
**Skills:** RLS, authentication, OWASP, data protection
**Focus Areas:**
- Row-Level Security policies
- Authentication/authorization
- Data leakage prevention
- Privacy compliance

### 6. Learning System Auditor
**Role:** ML Engineer / System Analyst
**Skills:** Reinforcement learning, feedback loops, decay functions
**Focus Areas:**
- Affinity learning correctness
- Decay mechanism effectiveness
- Feedback loop stability
- Cold-start handling

## Audit Agent Files

| File | Purpose |
|------|---------|
| `AUDIT-EXECUTION-PLAN.md` | **Comprehensive audit plan for News & Trends V2** |
| `00-master-orchestrator.md` | Coordinates all audits, generates consolidated report |
| `01-data-pipeline-auditor.md` | Schema integrity, data ingestion, deduplication |
| `02-filter-bubble-auditor.md` | Anti-echo-chamber, 70/30 split, diversity metrics |
| `03-algorithm-fairness-auditor.md` | Bias detection, demographic parity, outcome fairness |
| `04-domain-coverage-auditor.md` | Keyword completeness, entity recognition, geo tagging |
| `05-security-compliance-auditor.md` | RLS, authentication, injection prevention, compliance |
| `06-learning-system-auditor.md` | Affinity learning, decay, feedback loops, cold start |

## News & Trends V2 Deep Audit

For a comprehensive audit of the recent News & Trends V2 overhaul, use the detailed execution plan:

```bash
# Run the comprehensive V2 audit
claude -p "Execute the full audit using audit-agents/AUDIT-EXECUTION-PLAN.md"
```

The execution plan includes:
- **Phase 1:** Foundation Audit (Data Pipeline + Security) - parallel
- **Phase 2:** Classification Audit (Domain Coverage)
- **Phase 3:** Personalization Audit (Filter Bubble + Fairness) - parallel
- **Phase 4:** Learning System Audit
- **Phase 5:** Report Generation

See `AUDIT-EXECUTION-PLAN.md` for specific SQL queries, code review checklists, and success criteria.

## How to Run Audits

### Full Audit Suite
```bash
# Run all audits via master orchestrator
claude -p "Execute audit-agents/00-master-orchestrator.md for the News & Trends V2 system"
```

### Individual Audits
```bash
# Data pipeline quality
claude -p "Run audit-agents/01-data-pipeline-auditor.md"

# Filter bubble detection
claude -p "Run audit-agents/02-filter-bubble-auditor.md"

# Algorithm fairness
claude -p "Run audit-agents/03-algorithm-fairness-auditor.md"

# Domain coverage
claude -p "Run audit-agents/04-domain-coverage-auditor.md"

# Security & compliance
claude -p "Run audit-agents/05-security-compliance-auditor.md"

# Learning system
claude -p "Run audit-agents/06-learning-system-auditor.md"
```

## Audit Output Format

Each audit produces a structured report with:
- **Severity Levels:** CRITICAL, HIGH, MEDIUM, LOW, INFO
- **Finding Categories:** Bug, Gap, Missed Opportunity, Improvement
- **Remediation Recommendations:** Specific, actionable fixes
- **Evidence:** Code references, data samples, metric calculations

## Key Audit Targets

### Data Quality Targets
- Domain tagging rate: >80%
- Geographic tagging rate: >60%
- Data freshness: <6 hours

### Fairness Targets
- Score variance by org type: <2x
- New vs established org score: >80%
- Domain score variance: <10 points

### Diversity Targets
- NEW_OPPORTUNITY rate: 15-30%
- Single domain max: <40%
- Domain coverage: All declared domains represented

### Security Targets
- RLS coverage: 100% on org-scoped tables
- Cross-org data leaks: 0
- Injection vulnerabilities: 0

---

## Remediation System

After audits identify issues, specialized remediation agents fix them.

### Remediation Agent Files

| File | Focus Area | Issues Addressed |
|------|------------|------------------|
| `remediation/REMEDIATION-PLAN.md` | **Master remediation plan** | All findings |
| `remediation/10-security-remediator.md` | Security fixes | RLS, auth, service keys |
| `remediation/11-content-enhancer.md` | Content expansion | Keywords, entities, coverage |
| `remediation/12-algorithm-fixer.md` | Algorithm bugs | Logic, performance, learning |
| `remediation/13-schema-migrator.md` | Database changes | RLS policies, indexes |

### Running Remediation

```bash
# Execute full remediation plan
claude -p "Execute audit-agents/remediation/REMEDIATION-PLAN.md"

# Run specific remediation agent
claude -p "Execute audit-agents/remediation/10-security-remediator.md"
```

### Remediation Phases

1. **Phase 1: CRITICAL** - Blocking issues (learning system, RLS bypass)
2. **Phase 2: HIGH** - Major security and coverage gaps
3. **Phase 3: MEDIUM** - Performance and polish

### Latest Audit Report

See `AUDIT-REPORT-2026-01-19.md` for the most recent audit findings.
