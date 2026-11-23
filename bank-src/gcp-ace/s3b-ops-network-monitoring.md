// Section 3 continued: 3.3 networking operations, 3.4 monitoring and logging

### ace-3201 [3.3] d2 #subnet-expand
The subnet 10.10.0.0/24 in us-east1 is running out of IP addresses for new VMs. The adjacent range 10.10.1.0/24 isn't used anywhere. What's the least disruptive fix?
+ Expand the subnet's primary range to a /23 with expand-ip-range :: You can expand subnet primary ranges in place without downtime, as long as the new range doesn't overlap other subnets.
- Delete the subnet and recreate it as a /22 over the weekend :: You can't delete a subnet that has VMs in it, and recreating it is disruptive.
- Shrink neighboring subnets to free up addresses for this one :: Subnet ranges can't be shrunk.
- Add a secondary range and move the VMs' primary IPs to it :: Secondary ranges are for alias IPs (for example, GKE Pods). They don't add primary VM addresses.
> Subnet primary ranges can be expanded but never shrunk. Plan ranges with room to grow.

### ace-3202 [3.3] d1 #static-ip #promote
A VM's ephemeral external IP is allowlisted by a partner. You need to keep this exact IP even if the VM is stopped or recreated. What should you do?
- Note the IP and request it again after the VM restarts :: Ephemeral IPs aren't guaranteed to return.
+ Promote the in-use ephemeral IP to a static external IP :: You can promote an in-use ephemeral IP to a reserved static IP without changing it.
- Create a Cloud NAT with an automatic IP :: Automatic NAT IPs can change, and NAT is for egress.
- Pin the IP by setting it in the VM's metadata :: Metadata doesn't reserve IPs.
> You can promote ephemeral IPs to static. Reserve IPs that partners or DNS depend on.

### ace-3203 [3.3] d2 #static-internal-ip
A database VM must always have the internal IP 10.20.0.50 so that legacy apps configured with that IP keep working after the VM is recreated. What should you do?
+ Reserve 10.20.0.50 as a static internal IP and assign it to the VM :: Static internal IPs stay reserved independently of the VM's lifecycle.
- Rely on DHCP to always give the same IP :: Ephemeral internal IPs can change when a VM is recreated.
- Create a firewall rule that binds 10.20.0.50 to the VM's tag :: Firewall rules don't assign IPs.
- Use an alias IP range of /32 on every VM :: This is an unnecessary workaround. Reserve a static internal IP instead.
> Reserve static internal IPs for anything that's referenced by address.

### ace-3204 [3.3] d2 #routes
All traffic to an on-premises range 192.168.50.0/24 must go through a network virtual appliance (a firewall VM) in your VPC, rather than out the default route. What should you create?
- A firewall rule allowing 192.168.50.0/24 :: Firewall rules filter traffic. They don't route it.
+ A static route for 192.168.50.0/24 with the appliance as next hop :: Static routes send traffic for a destination to a chosen next hop, and appliances must have canIpForward enabled.
- A Cloud NAT gateway that uses the appliance's IP :: NAT translates outbound addresses and doesn't route to appliances.
- A Cloud DNS forwarding zone pointing at the appliance :: DNS resolution doesn't change packet routing.
> Custom static routes take a next hop (instance, ILB, VPN tunnel, or IP), and appliances need IP forwarding.

### ace-3205 [3.3] d2 #cloud-nat
Private VMs (no external IPs) in us-central1 need to download OS updates from the internet. Incoming connections from the internet must not be allowed. What should you configure?
- Assign external IPs and block ingress with firewall rules :: The VMs would still have public IPs, which violates the design.
+ Cloud NAT on a Cloud Router in us-central1 for the subnet :: Cloud NAT provides outbound-only internet access for VMs without external IPs. It's regional and managed.
- Private Google Access only :: This allows Google APIs only, not arbitrary internet hosts such as OS mirrors.
- An internal passthrough Network Load Balancer :: This load balances internal traffic and provides no egress.
> Cloud NAT gives outbound internet access to private resources. It's regional and configured on a Cloud Router.

### ace-3206 [3.3] d3 #cloud-nat #static
A partner allowlists your outbound IPs. Your private VMs use Cloud NAT with automatic IP allocation, and the partner reports connections from unexpected IPs. What should you change?
- Switch the VMs to external IPs :: This breaks the private-VM design.
+ Switch Cloud NAT to manually assigned static IPs and share them :: Manual allocation pins NAT egress to specific reserved addresses.
- Enable Private Google Access on the VMs' subnet :: This only affects Google API access.
- Increase the minimum ports per VM in the NAT config :: This changes port allocation, not which IPs are used.
> For stable egress IPs, use Cloud NAT with manual static IPs.

### ace-3207 [3.3] d2 #cloud-dns #private
You want VMs in two VPCs to resolve internal names like db.corp.internal, without exposing them on the public internet. What should you configure?
+ A Cloud DNS private zone authorized for both VPCs :: Private zones are visible only to the VPC networks you authorize.
- A public Cloud DNS zone with A records for internal IPs :: Public zones expose internal topology on the internet.
- An /etc/hosts file on every VM :: This is manual and doesn't scale.
- Cloud NAT with DNS64 enabled on both VPCs :: NAT is unrelated to name resolution.
> Use private zones for internal names, forwarding zones for on-premises DNS, and peering zones for another VPC's DNS.

### ace-3208 [3.3] d3 #cloud-dns #hybrid
VMs in your VPC must resolve hostnames in the on-premises domain onprem.example.com, served by on-premises DNS servers reachable over HA VPN. What should you configure?
- A private zone for onprem.example.com with copied records :: Copies go stale, and you'd have to maintain two sources of truth.
+ A forwarding zone that targets the on-premises DNS servers :: Forwarding zones send queries for that domain to your on-premises resolvers over the hybrid connection.
- A public zone delegated to the on-premises servers :: Public zones resolve on the internet. Private on-premises names need forwarding.
- Peer the VPC with the on-premises network :: VPC peering doesn't work with on-premises networks.
> Use forwarding zones (or outbound server policies) to reach on-premises DNS, and inbound server policies so on-premises can resolve Cloud DNS.

### ace-3209 [3.3] d2 #firewall #logging
You suspect a firewall rule is blocking traffic between two VMs. You want to confirm which rule is matching the connections. What should you do?
- Enable VPC Flow Logs only, on both subnets :: Flow logs record flows, but firewall rule logging shows which rule allowed or denied a connection.
+ Enable Firewall Rules Logging on the rules and check Logs Explorer :: Firewall rule logs record the rule name and whether a connection was allowed or denied.
- Run gcloud compute firewall-rules list --sort-by=priority :: This shows rules but not which one matched specific traffic.
- Check Cloud Trace for dropped spans :: Trace analyzes application request latency.
> Firewall Rules Logging shows which rule matched, and Connectivity Tests can simulate paths.

### ace-3210 [3.3] d2 #connectivity-tests
Before changing firewall policies, you want to simulate whether a VM in subnet A can reach a Cloud SQL private IP on port 5432, and see which configuration would block it. What tool should you use?
+ Connectivity Tests :: Connectivity Tests analyze configuration (routes, firewalls, NGFW policies) to predict reachability between endpoints and point out blocking rules.
- Cloud Profiler network view :: Profiler analyzes application CPU and memory.
- Cloud Asset Inventory search :: This lists resources but doesn't analyze reachability.
- Personalized Service Health :: This reports Google Cloud incidents.
> Connectivity Tests do configuration-based reachability analysis, which is great for troubleshooting before and after changes.

### ace-3211 [3.3] d2 #cloud-ngfw #manage
You need to temporarily block egress to a specific external IP range for all VMs in one VPC network that uses a global network firewall policy. What should you do?
- Edit the organization's hierarchical policy :: This is too broad, since it affects all VPCs in the organization.
+ Add an egress deny rule to the VPC's global network firewall policy :: Network firewall policies hold the rules for their associated VPCs, and a deny rule takes effect without changing other networks.
- Remove the service accounts from every VM in the VPC :: This breaks authentication and doesn't block egress.
- Disable the Compute Engine API until the block is lifted :: This is drastic and doesn't do what you need.
> Scope rule changes to the narrowest policy that covers the target: hierarchical for organizations and folders, network policies for VPCs.

### ace-3212 [3.3] d2 #firewall-insights
Your firewall rules have grown to hundreds over the years. You want to find rules that are shadowed by other rules or haven't been hit in months, so you can clean them up. What should you use?
- Cloud Billing reports :: These show costs, not rule usage.
+ Firewall Insights :: Firewall Insights reports shadowed rules, overly permissive rules, and hit counts, which helps with safe cleanup.
- Cloud DNS logging :: This logs DNS queries.
- VM Manager inventory :: This handles OS management.
> Firewall Insights shows shadowed, unused, and overly permissive rules.

### ace-3213 [3.3] d3 #nat #logs
Some private VMs intermittently fail to open outbound connections through Cloud NAT during traffic peaks. What's the likely cause, and what should you do?
+ NAT port exhaustion, so confirm with NAT logs and allocate more ports :: Each NAT IP has a limited number of ports. Under heavy concurrency, VMs can exhaust their allocated ports.
- Private Google Access is disabled on the subnet :: This only matters for Google APIs, and the failures are intermittent outbound connections.
- Firewall ingress rules block the return traffic for these connections :: Firewalls are stateful, so return traffic for allowed egress is permitted.
- The subnet is too small, so new connections lack IPs :: Subnet size limits VM IPs, not NAT ports.
> Intermittent NAT failures point to port exhaustion. Check NAT logs, then tune ports or add IPs.

### ace-3301 [3.4] d1 #alerting
You want to be emailed if any VM in a project has CPU utilization above 90% for 10 minutes. What should you do?
- Create a log-based metric on CPU entries in the VM syslog and alert on it :: CPU utilization is already a built-in metric.
+ An alerting policy on instance CPU utilization above 0.9 for 10 minutes, emailing you :: Alerting policies evaluate metric conditions and notify through channels.
- Create a budget alert that triggers on Compute Engine spend :: Budgets track cost.
- Run a cron job with top on each VM that emails when CPU is high :: This is manual and unscalable, and it has no central notification.
> Alerting policy = condition (metric + threshold + duration) + notification channel (+ documentation).

### ace-3302 [3.4] d2 #uptime-checks
You want to know within minutes if your public website stops responding from multiple locations around the world, and be paged. What should you configure?
+ An uptime check on the URL with an alerting policy :: Uptime checks probe from several global locations and can trigger alerts when checks fail.
- VPC Flow Logs on the web servers' subnet :: These record traffic and don't actively probe availability.
- Cloud Trace sampling of incoming requests :: Trace measures request latency for instrumented requests, not external availability.
- Error Reporting notifications on new errors :: This groups application errors but doesn't check reachability.
> Uptime checks test availability from outside, and alerting on them gives black-box monitoring.

### ace-3303 [3.4] d2 #ops-agent
You need memory utilization and disk space usage metrics for Compute Engine VMs, plus application logs from /var/log/myapp. The default metrics don't include memory. What should you do?
- Enable VPC Flow Logs on the VMs' subnet :: This handles network flows only.
+ Install the Ops Agent and add a log receiver for /var/log/myapp :: The Ops Agent collects in-guest metrics, such as memory and disk usage, and logs, including custom file paths.
- Enable Data Access audit logs :: These record API data access, not OS metrics.
- Move the VMs to a machine type that reports memory :: Size doesn't add metrics.
> Ops Agent provides in-guest metrics (memory, disk usage, processes) and logs from VMs.

### ace-3304 [3.4] d2 #log-based-metrics
Your application writes log entries containing "PAYMENT_FAILED". You want a chart of how often this happens and an alert when it exceeds 50 per minute. What should you do?
+ Create a counter log-based metric for the entries and alert on it :: Log-based metrics turn matching log entries into Cloud Monitoring metrics that you can chart and alert on.
- Export logs to BigQuery and run a query every minute :: This is heavy, delayed, and custom.
- Use Cloud Profiler to count PAYMENT_FAILED calls :: Profiler analyzes performance, not log patterns.
- Create an uptime check that searches responses for the text :: Uptime checks probe endpoints and don't count log entries.
> Log-based metrics (counter or distribution) give you alerting on log patterns.

### ace-3305 [3.4] d2 #custom-metrics
Your application needs to report a business metric (orders processed per minute) to Cloud Monitoring so you can create dashboards and SLO alerts. What's the recommended approach?
- Write the number to a file on disk :: Monitoring won't pick up arbitrary files.
+ Instrument the app with OpenTelemetry to write a custom metric :: Custom and Prometheus metrics give first-class time series for dashboards and alerts.
- Write the count to the VM's metadata every minute :: Metadata isn't a metrics pipeline.
- Update a VM label with the count every minute :: Labels are static metadata.
> For custom metrics, use OpenTelemetry, the Monitoring API, or Prometheus (managed). Log-based metrics also work for log-derived counts.

### ace-3306 [3.4] d1 #audit-logs
Which Cloud Audit Logs type is always enabled, can't be disabled, and records API calls that change resource configuration or metadata, such as creating a VM?
+ Admin Activity audit logs :: Admin Activity logs are always on, free, and record configuration changes.
- Data Access audit logs :: These are off by default (except BigQuery) and record reads of data and metadata.
- System Event audit logs :: These record Google system actions, not user API changes.
- Policy Denied audit logs :: These record access denied by security policies.
> Admin Activity: always on. Data Access: opt-in (BigQuery on). System Event: actions by Google. Policy Denied: policy violations.

### ace-3307 [3.4] d2 #audit-logs #data-access
Your auditors need a record of every time anyone reads objects in a sensitive Cloud Storage bucket. Currently, no such entries appear in the logs. What should you do?
- Nothing. Admin Activity logs record reads :: Admin Activity logs record configuration changes, not data reads.
+ Enable DATA_READ Data Access audit logs for Cloud Storage :: Data Access logs for Cloud Storage are disabled by default. Enabling DATA_READ records object reads, and it can increase log volume and cost.
- Enable VPC Flow Logs on every subnet in the project :: Flow logs don't record API-level object access.
- Enable Object Versioning and Autoclass on the bucket :: Versioning has nothing to do with access logging.
> Data Access logs must be enabled per service (except BigQuery). They can be noisy, so scope them carefully.

### ace-3308 [3.4] d2 #vpc-flow-logs
The security team wants to analyze network traffic metadata (source and destination IPs, ports, bytes) between VMs in a subnet for forensics. What should you enable?
- Firewall Rules Logging only :: This logs connections matched by specific rules, not general flow samples.
+ VPC Flow Logs on the subnet :: Flow Logs record samples of network flows to and from VMs, including 5-tuple and byte counts.
- Data Access audit logs for Compute Engine :: These record API calls, not network flows.
- Cloud Trace on the VMs :: Trace analyzes application request latency.
> VPC Flow Logs capture traffic metadata and are configured per subnet (with sampling).

### ace-3309 [3.4] d2 #log-sinks #bigquery
The security team wants all Admin Activity audit logs from every project in the organization to be queryable in a single BigQuery dataset in the "security-logs" project, including logs from projects created in the future. What should you do?
- Create a sink in each project and add new projects to a checklist :: This misses new projects and doesn't scale.
+ An organization-level aggregated sink to the dataset, with its writer identity granted access :: Aggregated sinks capture logs from all child projects, including new ones. The writer identity needs write access to the destination.
- Use a Cloud Asset Inventory export to BigQuery on a daily schedule :: Asset Inventory exports resource metadata, not audit logs.
- Download every project's logs with gcloud logging read every day :: This is manual and unscalable.
> Org-wide export uses an aggregated sink (--include-children) and needs the writer identity granted on the destination.

### ace-3310 [3.4] d2 #log-sinks #pubsub #siem
Your company uses an on-premises SIEM (for example, Splunk) and wants Google Cloud logs streamed to it in near real time. What's the recommended export path?
+ A log sink to Pub/Sub that the SIEM subscribes to :: Pub/Sub destinations stream logs to external systems in near real time.
- A log sink to Cloud Storage with an hourly download :: Cloud Storage sinks batch files, so it isn't near real time.
- Email logs with a notification channel :: Notification channels are for alerts, not log export.
- Copy logs from Logs Explorer into the SIEM every hour :: This is manual and not continuous.
> Export destinations: Cloud Storage for archive, BigQuery for analytics, Pub/Sub for streaming to third parties, and log buckets (including in other projects).

### ace-3311 [3.4] d2 #log-buckets #retention
You must keep application logs for 2 years for compliance, but the _Default log bucket keeps logs for 30 days. What should you do?
- Change the _Required bucket's retention to 2 years :: _Required has fixed 400-day retention and only holds audit and system logs.
+ Set the log bucket's retention to 730 days :: Log bucket retention can be set up to 3650 days. Cloud Storage archive can be cheaper for rarely accessed logs.
- Increase the project quota for logs :: Quotas don't control retention.
- Create a log-based metric for each log type :: Metrics count entries but don't keep the logs.
> _Required has fixed 400-day retention, _Default is 30 days and configurable, and custom buckets can keep logs up to 10 years.

### ace-3312 [3.4] d2 #log-analytics
Your SRE team wants to run SQL queries over recent logs (for example, joining request logs with error logs) without building an export pipeline. What should you do?
- Export to Cloud Storage and use a VM with grep :: This is slow, manual, and not SQL.
+ Upgrade the log bucket to Log Analytics and query with SQL :: Log Analytics lets you query log buckets with SQL directly, with no separate export.
- Use Cloud Trace's query editor :: Trace is for latency traces, not SQL over logs.
- Use Error Reporting's grouping filters :: Error Reporting groups exceptions but doesn't run SQL.
> Log Analytics brings SQL to log buckets, and you can link them to BigQuery for wider analysis.

### ace-3313 [3.4] d2 #exclusions #cost
Debug-level logs from a chatty service are driving up Cloud Logging costs, but you still want to keep warnings and errors. What should you do?
+ Add an exclusion on the _Default sink for that service's sub-WARNING logs :: Exclusions stop matching logs from being stored, which lowers ingestion cost.
- Delete the _Required bucket to free up log storage :: You can't delete it, and it only holds audit logs.
- Disable the Cloud Logging API for that service's project :: This would stop all logging, which is dangerous.
- Reduce the retention of the _Default bucket to 1 day for that project :: Ingestion is the main cost driver, and short retention loses useful logs.
> Log router exclusions reduce ingestion cost. You still control which logs go where with sinks.

### ace-3314 [3.4] d1 #logs-explorer #query
In Logs Explorer, you want to see only ERROR or worse entries from Compute Engine VMs. Which query should you use?
- severity=ERROR AND resource.type="gke_container" :: That's the wrong resource type, and it misses CRITICAL and above.
+ resource.type="gce_instance" AND severity>=ERROR :: This filters by resource type and by severity at or above ERROR.
- SELECT * FROM logs WHERE severity='ERROR' :: That's SQL, which is valid in Log Analytics but not the Logging query language.
- logName:"cloudaudit" AND severity<ERROR :: That returns audit logs below ERROR, which is the opposite of what you want.
> The Logging query language uses resource.type, severity>=, logName, jsonPayload.field, and textPayload:"text".

### ace-3315 [3.4] d2 #gcloud-logging
You want to retrieve the last 20 error entries for a Cloud Run service from the command line. Which command should you use?
+ gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND severity>=ERROR' --limit=20 :: gcloud logging read runs a Logging query from the CLI.
- gcloud run logs list --service=api --errors --limit=20 :: This isn't the correct syntax.
- kubectl logs deployment/api --tail=20 --selector=severity=ERROR :: Cloud Run isn't accessed through kubectl.
- bq query 'SELECT * FROM _Default WHERE service_name="api" AND severity="ERROR" LIMIT 20' :: Querying log buckets with SQL requires Log Analytics, and bq isn't used directly on log buckets.
> gcloud logging read 'FILTER' --limit --format is how you read logs from the CLI.

### ace-3316 [3.4] d2 #trace #profiler
Users report that an API endpoint sometimes takes 3 seconds. You want to know which downstream call (database, external API) contributes most to latency across distributed services. Which tool should you use?
- Cloud Profiler :: Profiler shows CPU and memory hot spots in code, not cross-service request latency.
+ Cloud Trace :: Cloud Trace records distributed traces and spans, showing where time is spent across services.
- Firewall Insights :: This analyzes firewall rules.
- Cloud Asset Inventory :: This inventories resources.
> Trace finds where a request's time goes across services. Profiler finds which functions use CPU or memory.

### ace-3317 [3.4] d2 #profiler
A Go service on GKE uses far more CPU than expected in production. You want continuous, low-overhead insight into which functions consume CPU and heap. What should you use?
+ Cloud Profiler :: Profiler continuously samples CPU and heap in production with low overhead and shows flame graphs by function.
- Cloud Trace :: Trace shows request latency spans, not function-level CPU usage.
- Uptime checks :: These check availability.
- VPC Flow Logs :: These record network metadata.
> Cloud Profiler is continuous production profiling of CPU, heap, and more.

### ace-3318 [3.4] d2 #query-insights #index-advisor
Your Cloud SQL for PostgreSQL instance shows high CPU, and you suspect slow queries. You want to identify the most expensive queries and get index recommendations. What should you use?
- Cloud Trace alone :: Trace may show slow database spans but doesn't analyze queries or suggest indexes.
+ Query Insights plus the index advisor :: Query Insights surfaces expensive queries, and the index advisor recommends indexes to speed them up.
- Increase the machine type without analysis :: This may help briefly, but it doesn't fix inefficient queries and costs more.
- VPC Flow Logs on the database subnet :: Network flows don't reveal query performance.
> For Cloud SQL and AlloyDB tuning, use Query Insights for top queries and the index advisor for missing indexes.

### ace-3319 [3.4] d2 #managed-prometheus
Your team already uses Prometheus exporters and PromQL dashboards on GKE, but running and scaling their own Prometheus servers is painful. What should they use?
- Rewrite all metrics as log-based metrics :: This is a large rewrite with no Prometheus compatibility.
+ Managed Service for Prometheus :: It collects Prometheus metrics at scale, stores them in Monarch, and supports PromQL in Cloud Monitoring and Grafana.
- Install Prometheus on a single large VM :: This is still self-managed, and the VM is a single point of failure.
- Cloud Trace with PromQL :: Trace isn't for metrics.
> Managed Service for Prometheus offers PromQL compatibility with no Prometheus servers to run.

### ace-3320 [3.4] d2 #gemini-cloud-assist #monitoring
An on-call engineer isn't fluent in PromQL. They want to describe a chart in plain language (for example, "p95 latency for the checkout service over the last day") and get a working query, and also get help investigating an alert. What can they use?
+ Gemini Cloud Assist in Cloud Monitoring :: Gemini Cloud Assist helps write queries, explain metrics, and investigate issues in Google Cloud Observability.
- Cloud Asset Inventory :: This inventories resources and doesn't build queries.
- Storage Transfer Service :: This moves data.
- Personalized Service Health alone :: It reports Google incidents but doesn't write PromQL.
> Gemini Cloud Assist helps with natural-language queries and AI-assisted investigations in Monitoring.

### ace-3321 [3.4] d2 #active-assist #recommender
You want to find idle VMs, oversized machine types, and unused IP addresses across your projects to cut costs. What should you check?
- Cloud Trace latency reports :: Trace isn't about resource utilization.
+ Active Assist recommendations :: Active Assist analyzes usage and suggests cost, security, and performance improvements, which you can apply or dismiss.
- VPC Flow Logs volume reports :: Flow logs don't show idle resources directly.
- Admin Activity logs :: These show changes, not utilization.
> Active Assist (Recommender) covers rightsizing, idle resources, IAM recommendations, and more.

### ace-3322 [3.4] d2 #cloud-hub
The operations team wants one console view that brings together active Google Cloud incidents affecting them, Monitoring alerts, quota usage, and cost trends for their applications. What should they use?
- Cloud Shell :: Cloud Shell is a terminal.
+ Cloud Hub :: Cloud Hub provides a centralized view of health, incidents, alerts, capacity, security posture, and cost for projects or App Hub applications.
- Cloud Scheduler :: Cloud Scheduler is a cron service.
- Artifact Registry :: Artifact Registry stores container images and packages.
> Cloud Hub is the operations home page across health, incidents, quotas, cost, and deployments.

### ace-3323 [3.4] d3 #multiple #logging
Which two statements about Cloud Logging are correct? (Choose two.)
+ Admin Activity audit logs are stored in the _Required bucket with 400-day retention, and that retention can't be changed :: _Required holds Admin Activity, System Event, and Access Transparency logs, among others, at no charge, with fixed retention.
- Data Access audit logs are enabled for all services by default :: Only BigQuery has them on by default, and they're opt-in elsewhere.
+ A sink's writer identity must be granted permission on the destination (for example, BigQuery Data Editor) before logs can be written :: Sinks write as a service identity, which needs IAM on the destination.
- Exclusion filters can be applied to the _Required sink :: You can't modify the _Required sink or exclude logs from it.
- Log-based metrics retroactively include logs from before the metric was created :: Log-based metrics only count entries received after creation.
> Know _Required versus _Default, writer identities, exclusions, and the fact that log-based metrics aren't retroactive.

### ace-3324 [3.4] d2 #error-reporting
Your Cloud Run service occasionally throws unhandled exceptions. You want them grouped automatically by stack trace, with counts and first-seen and last-seen times, and notification on new error types. What should you use?
- Cloud Profiler :: Profiler analyzes CPU and heap.
+ Error Reporting :: Error Reporting automatically aggregates errors from logs by stack trace and can notify on new errors.
- Uptime checks :: These check external availability.
- VPC Flow Logs :: These record network metadata.
> Error Reporting groups exceptions found in logs and alerts on new error types.

### ace-3325 [3.4] d2 #alerting #absence
A batch job writes a heartbeat metric every 5 minutes. You want to be alerted if the job stops sending the metric entirely. What condition type should you use?
+ A metric-absence condition :: Absence conditions fire when a time series stops reporting.
- A threshold condition of value > 0 :: If no data arrives, there's nothing for the threshold to evaluate.
- A budget alert on the batch project :: This is unrelated to job heartbeats.
- A log exclusion on heartbeat entries :: Exclusions drop logs. They don't alert.
> Use absence conditions for "it stopped reporting" and threshold conditions for "the value is too high or low".

### ace-3326 [3.4] d3 #slo
Your team wants to alert when the checkout service is burning its monthly error budget too fast, rather than on every brief error spike. What should you configure in Cloud Monitoring?
- A threshold alert on any 5xx response :: This is noisy and will page on every blip.
+ An SLO with a burn-rate alerting policy :: Burn-rate alerts fire when the error budget is being consumed faster than sustainable, which cuts down on noise.
- An uptime check every 15 minutes :: Uptime checks are black-box and don't track error budgets.
- A log exclusion for 5xx logs :: This hides errors instead of alerting.
> SLOs plus burn-rate alerts let you alert on user impact, not noise.
