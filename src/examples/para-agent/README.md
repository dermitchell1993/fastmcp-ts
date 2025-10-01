# PARA Automation Agent

A comprehensive productivity automation system that serves as your central coordination hub, implementing the PARA method (Projects, Areas, Resources, Archives) with intelligent task scoring and cross-platform synchronization.

## Overview

The PARA Automation Agent automates your productivity funnel while maintaining database coherence and identifying strategic opportunities. It integrates with Notion, Linear, Slack, and Codegen to provide a unified productivity management system.

### Key Features

- **Task Score Calculation**: Amplenote-style intelligent prioritization using activity patterns, urgency, importance, and momentum
- **PARA Funnel Automation**: Automatic movement of items through stages (Jots → Tasks → Projects → Areas → Resources → Archives)
- **Cross-Platform Synchronization**: Maintains coherence between Notion databases and Linear issues
- **Strategic Opportunity Detection**: Identifies building blocks, bottlenecks, and delegation candidates
- **Periodic Summaries**: Automated Slack notifications with productivity insights
- **Database Coherence**: Automatic detection and fixing of broken links, orphaned items, and inconsistencies
- **Valkey Caching**: High-performance Redis-compatible caching for API responses, task scores, and computed data

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Notion      │    │     Linear      │    │     Slack       │
│   Databases     │◄──►│     Issues      │◄──►│ Notifications   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │   PARA Agent Core   │
                    │                     │
                    │ • Task Score Engine │
                    │ • Funnel Automation │
                    │ • Coherence Engine  │
                    │ • Opportunities     │
                    │ • Scheduler         │
                    └─────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │   MCP Server        │
                    │   (FastMCP)         │
                    └─────────────────────┘
```

## Caching with Valkey

The PARA Agent uses Valkey (Redis-compatible) caching to improve performance and reduce API calls:

- **Task Scores**: Cached for 1 hour to avoid recomputation
- **API Responses**: Cached for 5 minutes to reduce external API calls
- **Opportunities Analysis**: Cached for 30 minutes
- **Coherence Checks**: Cached for 15 minutes

### Benefits:
- ⚡ **Faster Response Times**: Cached results served instantly
- 📉 **Reduced API Load**: Fewer calls to Notion, Linear, and Slack APIs
- 💰 **Cost Savings**: Lower API usage costs
- 🔄 **Better Reliability**: Graceful degradation when APIs are unavailable

### Cache Invalidation:
- Automatic TTL-based expiration
- Manual cache clearing via MCP tools
- Context-aware cache keys prevent stale data

## Setup

### Prerequisites

- Node.js 18+
- Notion API access with database permissions
- Slack bot token with messaging permissions
- Linear API key (optional but recommended)
- Valkey/Redis server (optional but recommended for performance)

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Notion Configuration
NOTION_API_KEY=your_notion_api_key
NOTION_JOTS_DB=database_id_for_jots
NOTION_TASKS_DB=database_id_for_tasks
NOTION_PROJECTS_DB=database_id_for_projects
NOTION_AREAS_DB=database_id_for_areas
NOTION_RESOURCES_DB=database_id_for_resources
NOTION_ARCHIVES_DB=database_id_for_archives

# Linear Configuration (Optional)
LINEAR_API_KEY=your_linear_api_key
LINEAR_TEAM_ID=your_team_id

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=C1234567890
SLACK_USER_ID=U1234567890

# Valkey Cache Configuration (Optional - improves performance)
VALKEY_ENABLED=true
VALKEY_HOST=localhost
VALKEY_PORT=6379
VALKEY_PASSWORD=your_password  # Optional
VALKEY_DB=0
VALKEY_KEY_PREFIX=para:
VALKEY_TTL_TASK_SCORES=3600    # 1 hour
VALKEY_TTL_API_RESPONSES=300   # 5 minutes
VALKEY_TTL_OPPORTUNITIES=1800  # 30 minutes
VALKEY_TTL_COHERENCE=900       # 15 minutes

# General Configuration
TZ=America/New_York
LOG_LEVEL=info
```

### Notion Database Setup

Create 6 databases in Notion with the following schemas:

#### Jots Database
- Title (Text)
- Description (Text)
- Tags (Multi-select)
- Created (Date)
- Source (Select: notion, linear, manual)

#### Tasks Database
- Title (Text)
- Description (Text)
- Stage (Select: jots, tasks, projects, areas, resources, archives)
- Priority (Number: 1-10)
- Tags (Multi-select)
- Due Date (Date)
- Dependencies (Relation to Tasks)
- Blockers (Relation to Tasks)
- Cross-Area Impact (Multi-select)
- Task Score (Number)
- Color Code (Select: red, gold, normal)
- Created (Date)
- Updated (Date)
- Completed (Date)
- Source (Select: notion, linear, manual)
- Source ID (Text)

#### Projects Database
- Title (Text)
- Description (Text)
- Stage (Select)
- Tasks (Relation to Tasks)
- Areas (Multi-select)
- Priority (Number: 1-10)
- Tags (Multi-select)
- Due Date (Date)
- Progress (Number: 0-100)
- Building Blocks (Text)
- Dependencies (Relation to Projects)
- Created (Date)
- Updated (Date)
- Completed (Date)
- Source (Select)
- Source ID (Text)

#### Areas Database
- Title (Text)
- Description (Text)
- Projects (Relation to Projects)
- Resources (Relation to Resources)
- Priority (Number: 1-10)
- Tags (Multi-select)
- Goal (Text)
- KPIs (Text)
- Created (Date)
- Updated (Date)
- Source (Select)
- Source ID (Text)

#### Resources Database
- Title (Text)
- Description (Text)
- Type (Select: note, document, link, file, reference)
- Content (Text)
- URL (URL)
- Tags (Multi-select)
- Created (Date)
- Updated (Date)
- Last Accessed (Date)
- Access Count (Number)
- Related Areas (Relation to Areas)
- Source (Select)
- Source ID (Text)

#### Archives Database
- Title (Text)
- Description (Text)
- Original Stage (Select)
- Archived (Date)
- Reason (Select: completed, obsolete, deferred, consolidated)
- Relationships (Text)
- Lessons Learned (Text)
- Source (Select)
- Source ID (Text)

### Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run the PARA agent
node dist/examples/para-agent/server.js
```

## Usage

### MCP Tools

The agent provides the following MCP tools:

#### Core PARA Tools
- `get_para_status` - Get system status and configuration
- `calculate_task_score` - Calculate Task Score for an item
- `run_funnel_automation` - Trigger funnel automation
- `check_database_coherence` - Check and fix coherence issues
- `analyze_strategic_opportunities` - Find strategic opportunities
- `send_manual_summary` - Send a status summary

#### Scheduler Tools
- `get_scheduler_status` - Get scheduler status
- `start_scheduler` - Start automated runs
- `stop_scheduler` - Stop automated runs

#### Notion Tools
- `query_notion_stage` - Query items in a PARA stage
- `move_notion_item` - Move item to different stage
- `update_notion_properties` - Update item properties

#### Linear Tools
- `query_linear_issues` - Query Linear issues
- `update_linear_issue` - Update Linear issue
- `create_linear_subtasks` - Create subtasks

#### Slack Tools
- `send_para_summary` - Send formatted summary
- `send_para_notification` - Send specific notification
- `send_direct_message` - Send DM to user

### Task Score Algorithm

The Task Score is calculated using Amplenote's philosophy:

**Factors:**
- **Note Activity** (0-10): Based on access frequency
- **Urgency** (0-10): Critical/urgent tags, high priority
- **Importance** (0-10): Goal-related, strategic items (3x weight)
- **Deadline Pressure** (0-10): Due today/overdue = 10 points
- **Duration** (0-2): Quick wins get boost
- **Blocking** (0-5): Items blocking others get priority
- **Cross-Area Impact** (0-5): Items affecting multiple areas
- **Age** (-∞-0): Older items decay unless active
- **Momentum** (0-5): Recent activity boosts score

**Color Coding:**
- 🔴 Red: Score ≥ 10 (urgent action needed)
- 🟡 Gold: Score ≥ 5 (good candidates for work)
- ⚪ Normal: Score < 5 (lower priority)

### PARA Funnel Automation

Items automatically move through stages based on rules:

**Jots → Tasks**: When detailed enough or >7 days old
**Tasks → Projects**: When complex with dependencies
**Tasks/Projects → Archives**: When completed
**Projects → Areas**: When long-running (>30 days)
**Areas → Resources**: When inactive (>6 months)

### Strategic Opportunities

The system identifies:
- **Building Blocks**: Completed projects with reusable components
- **Near Completion**: Projects >80% done that unblock others
- **Cross-Area Impact**: Items affecting multiple domains
- **High Dependencies**: Bottlenecks blocking many items
- **Delegation Candidates**: Well-defined tasks suitable for others

### Periodic Automation

The scheduler runs automated checks:
- **Funnel**: Every 6 hours
- **Coherence**: Daily
- **Opportunities**: Every 12 hours
- **Summaries**: Daily at preferred hour

## Integration with Codegen

The PARA agent integrates with Codegen for:
- GitHub issue synchronization
- PR status tracking
- Commit message analysis
- Workflow automation triggers

Future integrations include Kilo Code for email/calendar connections.

## Development

### Project Structure

```
src/examples/para-agent/
├── server.ts              # Main MCP server
├── config/
│   └── index.ts          # Configuration management
├── tools/
│   ├── notion.ts         # Notion API integration
│   ├── linear.ts         # Linear API integration
│   └── slack.ts          # Slack API integration
├── engine/
│   ├── taskScore.ts      # Task Score calculation
│   ├── funnel.ts         # PARA automation logic
│   ├── coherence.ts      # Database coherence
│   └── opportunities.ts  # Strategic analysis
├── scheduler/
│   └── index.ts          # Periodic automation
└── types/
    ├── para.ts           # PARA data models
    └── task.ts           # Task Score types
```

### Testing

```bash
# Run tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format
```

### Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure type safety

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section below
- Review the Notion database schemas
- Verify API permissions
- Check logs for error messages

### Troubleshooting

**Configuration Issues:**
- Ensure all required environment variables are set
- Verify Notion database IDs are correct
- Check Slack bot permissions

**API Errors:**
- Confirm API keys are valid and have proper permissions
- Check rate limits for each service
- Verify webhook URLs if using integrations

**Automation Not Working:**
- Check scheduler status with `get_scheduler_status`
- Review logs for error messages
- Verify database permissions and schemas

**Performance Issues:**
- Reduce check intervals in scheduler config
- Limit query sizes for large databases
- Use pagination for API calls
