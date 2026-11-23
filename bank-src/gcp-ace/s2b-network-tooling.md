// Section 2 continued: 2.3 networking, 2.4 tooling

### ace-2101 [2.3] d1 #vpc #subnets
Which statement about VPC networks and subnets in Google Cloud is correct?
- VPC networks and subnets are both zonal resources :: VPCs are global and subnets are regional.
+ VPC networks are global, and subnets are regional :: This is a key Google Cloud difference from other clouds, where networks are regional and subnets are zonal.
- A subnet can span several regions of one network :: Subnets are regional.
- Each project can have only one VPC network :: A project can have several VPC networks, subject to quota.
> VPC is global, subnets are regional, and VMs are zonal.

### ace-2102 [2.3] d2 #shared-vpc
Your organization wants a central network team to manage one VPC, including subnets, firewall rules, and VPN, while application teams deploy VMs in their own projects attached to that network. What should you set up?
- VPC Network Peering between every application project :: Peering connects separately administered networks. It doesn't centralize administration.
+ Shared VPC with a network-team host project :: Shared VPC lets service projects use subnets from a centrally managed host project VPC.
- One shared project for every team's VMs :: This removes project-level isolation, billing separation, and IAM boundaries.
- HA VPN tunnels between the application projects :: VPN is for connecting to external networks, which is unnecessary here.
> Shared VPC means centralized network administration with a host project and decentralized workloads in service projects.

### ace-2103 [2.3] d2 #shared-vpc #iam
In a Shared VPC setup, a developer in a service project can't create a VM on the shared subnet "app-subnet". What role do they need, and where should it be granted?
+ Compute Network User on app-subnet in the host project :: Network User allows using shared subnets. Granting it at subnet level limits which subnets a service project's users can use.
- Compute Network Admin on the service project :: Network Admin on the service project doesn't grant use of the host project's subnets.
- Shared VPC Admin on the organization :: This is far too much privilege, since it's for configuring host and service projects.
- Compute Instance Admin on the host project :: This allows creating VMs in the host project, not using its subnet from a service project.
> Shared VPC: Shared VPC Admin sets up host and service projects, and Network User (subnet or host level) lets users deploy into shared subnets.

### ace-2104 [2.3] d2 #peering
Two VPC networks in different organizations need private RFC 1918 connectivity with low latency and no gateways. Network A peers with B, and B peers with C. Can A reach C through B?
- Yes. Peering routes are transitive :: VPC Network Peering isn't transitive.
+ No. Peering isn't transitive, so A must peer with C :: Peered networks exchange only their own subnet routes with direct peers.
- Yes, if you enable export custom routes :: Exporting custom routes shares static and dynamic routes with a direct peer. It doesn't make subnet routes transitive across peers.
- Only if all three networks use auto mode :: Mode is irrelevant, and overlapping auto mode ranges would actually prevent peering.
> Peering is non-transitive, needs non-overlapping ranges, works across projects and organizations, and keeps traffic on Google's network.

### ace-2105 [2.3] d1 #firewall
You create a new custom VPC with no firewall rules. Which traffic is allowed by default?
- All ingress and egress is allowed :: Ingress isn't allowed by default.
+ Egress is allowed and ingress is denied :: Every VPC has an implied allow-egress and an implied deny-ingress rule, both at the lowest priority (65535).
- All ingress is allowed and all egress is denied :: That's backwards.
- Only SSH and ICMP ingress is allowed :: Those rules exist only in the default network (default-allow-ssh and similar), not in new custom VPCs.
> Implied rules: allow egress, deny ingress. Only the default network ships with extra allow rules.

### ace-2106 [2.3] d2 #firewall #priority
Two VPC firewall rules apply to a VM: rule A denies TCP 22 from 0.0.0.0/0 with priority 1000, and rule B allows TCP 22 from 35.235.240.0/20 (the IAP range) with priority 900. What happens to SSH from IAP?
+ It's allowed, because rule B's lower number gives it priority :: For VPC firewall rules, the lowest priority number wins. Allowing IAP's range at 900 overrides the broader deny at 1000.
- It's denied, because deny rules always win over allow rules :: Deny wins only when priorities are equal.
- It's denied, because the rule with the higher number has priority :: Lower numbers mean higher priority.
- It depends on which rule was created first in the VPC :: Creation time doesn't matter.
> Firewall priority runs from 0 (highest) to 65535. At equal priority, deny beats allow.

### ace-2107 [2.3] d2 #firewall #service-accounts
You want firewall rules to allow traffic from frontend VMs to backend VMs on TCP 8080. Developers can edit VM metadata and network tags, so the security team wants targets that developers can't change easily. What should you use as the source and target?
- Network tags on both sets of VMs :: Anyone with permission to edit instances can change network tags, which weakens the control.
+ Service accounts for source and target :: Changing a VM's service account requires stopping it and having IAM permission to use that service account. Secure tags are governed by IAM.
- IP ranges of the VMs' subnets :: Ranges are coarse and change as VMs are added or moved.
- The VM names of each tier :: You can't use VM names as firewall targets.
> For stronger identity-based targeting, use service accounts or secure tags rather than network tags.

### ace-2108 [2.3] d3 #cloud-ngfw #hierarchical
The security team wants to block all ingress from a list of known-malicious IP ranges for every VPC in every project of the organization, and make sure project owners can't override it. What should you use?
- A VPC firewall rule in each project at priority 0 :: Project owners can delete or override VPC rules, and you'd have to maintain them everywhere.
+ A hierarchical firewall policy on the organization :: Hierarchical firewall policies are evaluated before VPC firewall rules and network policies, and project-level admins can't override a deny there.
- A global network firewall policy in one project :: Network firewall policies apply only to the VPCs they're associated with.
- A Cloud Armor policy with an IP denylist :: Cloud Armor protects load-balanced applications, not all VM ingress in every VPC.
> Hierarchical firewall policies (organization or folder) are evaluated first and enforce company-wide rules. They can goto_next to delegate.

### ace-2109 [2.3] d3 #cloud-ngfw #secure-tags
You're migrating from VPC firewall rules to Cloud NGFW global network firewall policies. You want rule targets based on attributes that only security administrators can attach to VMs, governed by IAM. What should you use for targets?
- Network tags on the VMs :: Instance admins can freely add network tags, and they aren't IAM-governed.
+ Secure tags bound to the VMs :: Secure tags are IAM-controlled, so only principals with tag-user permissions can bind them. Network firewall policies support them as targets and sources.
- Labels on the VMs :: Cloud NGFW can't use labels in rules.
- Instance names and name prefixes :: Names aren't supported as firewall targets.
> Cloud NGFW network firewall policies support IAM-governed secure tags for targets and sources.

### ace-2110 [2.3] d2 #vpn #ha
You need encrypted connectivity from your data center to a VPC with a 99.99% availability SLA and dynamic routing. Your bandwidth needs are modest (a few Gbps). What should you deploy?
- Classic VPN with static routes on two tunnels :: Classic VPN offers a 99.9% SLA, and static routes don't adapt automatically.
+ HA VPN with two tunnels and BGP through Cloud Router :: HA VPN provides a 99.99% SLA when configured with redundant tunnels, and Cloud Router exchanges routes dynamically with BGP.
- Dedicated Interconnect with a single circuit :: Dedicated Interconnect isn't encrypted by default and is aimed at 10–100 Gbps needs with colocation.
- VPC Network Peering to on-premises :: Peering connects VPC networks only.
> HA VPN plus Cloud Router (BGP) gives a 99.99% SLA over the internet, encrypted with IPsec.

### ace-2111 [2.3] d2 #interconnect
Your company needs a private, high-bandwidth (20 Gbps) connection to Google Cloud. You don't have equipment in a Google colocation facility, but your network provider supports Google Cloud. What should you choose?
- Dedicated Interconnect :: Dedicated Interconnect requires your router in a supported colocation facility.
+ Partner Interconnect :: Partner Interconnect connects through a supported provider when you can't meet Google at a colocation facility, with capacities from 50 Mbps up to 50 Gbps.
- HA VPN over the internet :: It's encrypted, but it runs over the public internet with lower and less predictable throughput.
- Cross-Cloud Interconnect :: Cross-Cloud Interconnect connects Google Cloud to other cloud providers.
> Dedicated Interconnect means you're in a colocation facility (10 or 100 Gbps circuits). Partner Interconnect goes through a provider (50 Mbps to 50 Gbps).

### ace-2112 [2.3] d2 #load-balancing
You need to expose a global HTTPS web application with URL-based routing (/api to one backend, /static to a bucket), a single anycast IP, Cloud CDN, and Cloud Armor. Which load balancer should you use?
+ Global external Application Load Balancer :: It's a global layer-7 proxy with URL maps, anycast IP, Cloud CDN, Cloud Armor, and backend buckets.
- Regional external passthrough Network Load Balancer :: It's layer 4 and regional, with no URL routing or CDN.
- Internal Application Load Balancer :: It's only for internal clients.
- External proxy Network Load Balancer :: It works at layer 4 for TCP/SSL, with no HTTP path routing.
> HTTP(S) plus global plus path routing plus CDN or Armor means the global external Application Load Balancer.

### ace-2113 [2.3] d2 #load-balancing #udp
A multiplayer game server uses UDP and must see the original client IP address. Players connect from the internet to VMs in a single region. Which load balancer fits?
- Global external Application Load Balancer :: It handles HTTP(S) only, not raw UDP.
+ External passthrough Network Load Balancer :: This regional layer-4 passthrough balancer supports TCP and UDP and preserves the client source IP.
- Internal passthrough Network Load Balancer :: It's internal only.
- External proxy Network Load Balancer :: It's a proxy for TCP that terminates connections and doesn't support UDP passthrough.
> UDP or client IP preservation points to a passthrough Network Load Balancer (external or internal).

### ace-2114 [2.3] d2 #load-balancing #internal
Microservices running on VMs in a VPC need to call an internal HTTP API service with path-based routing. The service must not be reachable from the internet. Which load balancer should you use?
- Global external Application Load Balancer with firewall rules :: It's still an internet-facing frontend.
+ Internal Application Load Balancer :: It provides layer-7 load balancing with URL maps for clients inside your VPC or connected networks, using a private IP.
- External passthrough Network Load Balancer :: It's internet-facing and layer 4.
- Cloud NAT :: Cloud NAT provides outbound internet access and doesn't load balance.
> Internal and L7 means the internal Application Load Balancer. Internal and L4 means the internal passthrough Network Load Balancer.

### ace-2115 [2.3] d2 #network-tiers
A cost-sensitive regional application serves users mostly in the same region. You want to reduce egress networking costs and accept slightly lower performance. What should you choose?
- Premium Tier with a global load balancer :: Premium is the higher-performance, higher-cost tier.
+ Standard Tier networking with a regional load balancer :: Standard Tier routes traffic over the public internet closer to the user's region and costs less, but it supports only regional load balancing.
- Cloud CDN in front of all traffic, including dynamic requests :: CDN helps with cacheable content only, and this is about the network tier.
- Partner Interconnect for user traffic :: That's for hybrid connectivity, not internet egress for users.
> Premium Tier uses Google's global backbone and supports global load balancing. Standard Tier is cheaper, regional, and uses the public internet.

### ace-2116 [2.3] d2 #private-google-access
VMs on a subnet have no external IP addresses. They need to read objects from Cloud Storage and call BigQuery APIs. What's the simplest way to allow this?
- Assign external IPs to the VMs :: This violates the no-external-IP design.
+ Enable Private Google Access on the subnet :: Private Google Access lets VMs with only internal IPs reach Google APIs and services.
- Create VPC peering with Google's network :: You can't peer with Google APIs this way. Private Service Connect for APIs is a different, more advanced option.
- Create a Cloud VPN to Google :: VPN is for external networks.
> Private Google Access is a per-subnet setting that lets internal-only VMs reach Google APIs. Cloud NAT handles general internet access.

### ace-2117 [2.3] d3 #multiple #networking
Your company is connecting on-premises networks to Google Cloud and planning VPCs. Which two practices are recommended? (Choose two.)
+ Plan non-overlapping RFC 1918 ranges across on-premises and all VPCs before creating subnets :: Overlapping ranges block peering and complicate hybrid routing, and they're hard to fix later.
- Use auto mode VPCs in production so subnets are created automatically :: Auto mode uses predefined ranges that often overlap with corporate networks.
+ Use HA VPN or Interconnect with Cloud Router for dynamic BGP routing :: Dynamic routing adapts to changes and supports redundancy.
- Allow ingress from 0.0.0.0/0 on all ports to simplify troubleshooting :: This exposes every VM to the internet.
- Put every workload in one subnet to simplify routing :: One subnet removes segmentation and limits regional design.
> Plan the IP space, use custom VPCs, use dynamic routing, and keep firewall rules least-privilege.

### ace-2118 [2.3] d2 #psc #private-services
Your VMs must connect to a Cloud SQL instance using only private IP addresses, with no public IP on the database. What should you configure?
- Assign the Cloud SQL instance a public IP with authorized networks :: This uses a public IP, which the requirement rules out.
+ Private IP for Cloud SQL through private services access :: Cloud SQL private IP places the instance reachable on internal addresses from your VPC.
- Cloud NAT on the VMs' subnet, so they reach the database privately :: NAT handles outbound internet access, not private database connectivity.
- A global external Application Load Balancer in front of Cloud SQL :: You don't front Cloud SQL with an Application Load Balancer.
> Managed services on private IPs use private services access or Private Service Connect.

### ace-2119 [2.3] d1 #static-ip #dns
You're designing a public website on a load balancer and need the IP to stay the same if the load balancer is recreated, so your DNS record doesn't need to change. What should you do during planning?
+ Reserve a static external IP for the forwarding rule :: Reserved static IPs persist independently of the resources that use them.
- Use an ephemeral IP and update DNS whenever it changes :: Ephemeral IPs can change, which causes downtime and DNS churn.
- Use the VM's internal IP in public DNS :: Internal IPs aren't reachable from the internet.
- Use the Cloud NAT gateway's IP address in DNS :: Cloud NAT IPs are for outbound traffic.
> Reserve static IPs for anything that DNS records or allowlists point to.

### ace-2201 [2.4] d2 #terraform #state
Your team manages Google Cloud infrastructure with Terraform. Several engineers run Terraform, and you've had state conflicts and lost state files. What should you do?
- Commit terraform.tfstate to Git after every apply :: State files can contain secrets, and Git doesn't provide locking.
+ Use a versioned Cloud Storage bucket as the Terraform backend :: A remote GCS backend gives shared state with locking, and versioning lets you recover earlier state.
- Let each engineer keep a local state file and merge them weekly :: Divergent local states cause drift and conflicting changes.
- Delete the state file before each run so Terraform rebuilds it :: Terraform would try to recreate existing resources.
> Use a remote state backend in GCS with versioning. Its locking prevents concurrent applies.

### ace-2202 [2.4] d2 #config-connector
Your platform team runs everything through Kubernetes and GitOps. They want to manage Cloud Storage buckets, Pub/Sub topics, and IAM bindings as Kubernetes resources in YAML. What should they use?
- Helm only :: Helm packages Kubernetes applications. By itself it doesn't create Google Cloud resources.
+ Config Connector :: Config Connector is a Kubernetes add-on that lets you manage Google Cloud resources as Kubernetes custom resources.
- Cloud Build triggers that run gcloud :: This is imperative scripting, not declarative Kubernetes-native management.
- kubectl port-forward :: This is a debugging tool, not infrastructure management.
> Config Connector manages Google Cloud resources with Kubernetes-style YAML (KRM), and it fits GitOps.

### ace-2203 [2.4] d1 #helm
You need to install a third-party application (for example, a monitoring stack) on your GKE cluster. It's distributed as a packaged chart with configurable values. Which tool is designed for this?
+ Helm :: Helm is the package manager for Kubernetes. Charts bundle manifests and values for repeatable installs and upgrades.
- Terraform's google provider only :: The google provider manages cloud resources. You'd still need Helm (or the Helm provider) for the chart.
- Fabric FAST :: FAST bootstraps organization landing zones. It doesn't install in-cluster apps.
- gcloud compute ssh :: SSH isn't a deployment mechanism for Kubernetes apps.
> Helm installs and upgrades packaged Kubernetes applications (charts).

### ace-2204 [2.4] d2 #fabric-fast #landing-zone
Your company is setting up a new Google Cloud organization and wants an opinionated, Terraform-based blueprint that bootstraps the resource hierarchy, IAM, organization policies, networking, and logging following Google best practices. What should they evaluate?
- Cloud Shell tutorials :: These are learning aids, not a production landing zone framework.
+ Cloud Foundation Fabric FAST :: Fabric FAST provides Terraform stages to set up an enterprise landing zone (bootstrap, resource management, security, networking, and project factory).
- Helm charts for the organization :: Helm targets Kubernetes apps, not organization-wide setup.
- Cloud Deploy pipelines :: Cloud Deploy is for application delivery pipelines.
> Fabric FAST is Terraform-based, opinionated organization and landing zone automation.

### ace-2205 [2.4] d2 #app-design-center
A platform team wants to publish approved, policy-aligned application architecture templates (for example, Cloud Run with Cloud SQL and a load balancer) that developers can customize and deploy themselves. The templates should generate Terraform. Which Google Cloud product is built for this?
- Cloud Asset Inventory :: It inventories existing resources. It doesn't design or deploy templates.
+ Application Design Center :: App Design Center lets admins build and share application templates in catalogs. Developers configure and deploy them, and the designs generate Terraform.
- Cloud Scheduler :: Cloud Scheduler is a cron service.
- Personalized Service Health :: It reports Google Cloud incidents.
> Application Design Center provides governed, reusable app templates backed by Terraform, and deployed apps register in App Hub.

### ace-2206 [2.4] d2 #gemini-cloud-assist #design
You're designing a new three-tier application and want an AI assistant in the Google Cloud console to propose an architecture from a natural-language description and help you refine it before deployment. What should you use?
+ Gemini Cloud Assist with Application Design Center :: Gemini Cloud Assist can propose and explain architectures and work with App Design Center to produce deployable designs.
- Cloud Logging Log Analytics :: Log Analytics analyzes logs with SQL. It doesn't design architectures.
- Cloud Profiler with design recommendations :: Cloud Profiler analyzes CPU and memory usage in running code.
- VM Manager OS policy templates :: VM Manager patches and inventories VMs.
> Gemini Cloud Assist does AI-assisted design, troubleshooting, and optimization inside Google Cloud.

### ace-2207 [2.4] d2 #gemini-cli #antigravity
A developer wants an AI agent that can read their repository, write code, run commands in a terminal, and help generate Terraform for Google Cloud, working directly in their local development environment. Which tools from the exam guide fit? (Choose two.)
+ Gemini CLI :: Gemini CLI is a terminal-based AI agent that can work with local files and run commands. Google has been folding it into Antigravity CLI.
+ Google Antigravity :: Antigravity is Google's agent-first development platform (IDE and CLI) where agents plan, write, and test code.
- Cloud Asset Inventory :: This inventories cloud resources and doesn't write code.
- BigQuery Data Transfer Service :: This loads data into BigQuery.
- Cloud NAT :: This provides outbound network address translation.
> Developer-side AI agents include Gemini CLI and Google Antigravity. In the console, it's Gemini Cloud Assist.

### ace-2208 [2.4] d2 #iac #why
Your manager asks why the team should use infrastructure as code (for example, Terraform) instead of creating resources by clicking in the console. Which benefit is most accurate?
- IaC deployments are always cheaper because Google discounts API-created resources :: Resources cost the same however they're created.
+ IaC makes infrastructure repeatable, reviewable, and less prone to drift :: Code review, versioning, and consistent dev, test, and prod environments are the main benefits.
- IaC removes the need to grant IAM permissions to engineers :: The identity running IaC still needs appropriate IAM roles.
- IaC is required to create GKE clusters and node pools :: You can create GKE clusters in the console or with gcloud.
> IaC gives repeatability, code review, versioning, and drift detection.

### ace-2209 [2.4] d3 #terraform #plan
Before applying changes to production with Terraform, you want to see exactly which resources will be created, changed, or destroyed, and have a teammate review it. What should you do?
- Run terraform apply -auto-approve and review afterward :: That applies changes without a review.
+ Run terraform plan -out=tfplan, review it, then apply that saved plan :: Saved plans make sure the reviewed changes are exactly what gets applied.
- Run terraform destroy and recreate everything :: This is destructive and unnecessary.
- Run terraform fmt and terraform validate, then apply :: fmt only formats code.
> terraform plan previews changes, and applying a saved plan applies exactly what was reviewed.

### ace-2210 [2.4] d2 #infra-manager
You want to run Terraform deployments in Google Cloud without maintaining your own Terraform runners, state buckets, or CI workers, and you want deployments recorded and managed as Google Cloud resources. What can you use?
- Cloud Deployment Manager :: Deployment Manager is Google's older, non-Terraform IaC service and is being retired in favor of Terraform-based tooling.
+ Infrastructure Manager :: Infrastructure Manager is a managed service that deploys Terraform configurations, stores state, and keeps revision history.
- Cloud Shell with a cron job :: Cloud Shell is an interactive environment and doesn't manage state or deployments.
- Config Sync from a Git repository :: Config Sync syncs Kubernetes configuration from Git to clusters.
> Infrastructure Manager is managed Terraform execution and state on Google Cloud.
