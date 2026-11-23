// Section 1: Setting up a cloud solution environment (~20%)
// Objective 1.1 Setting up cloud projects and accounts / 1.2 Managing billing configuration

### ace-1001 [1.1] d1 #resource-hierarchy
Your company is adopting Google Cloud. The security team wants one place to apply policies that should affect every project, and the finance, engineering, and marketing departments each want to manage their own projects. What resource hierarchy should you set up?
- Create one project per department and grant each department head the Owner role on the other departments' projects :: Projects can't contain other projects, and giving Owner across departments breaks separation. You'd have no central place for company-wide policy.
+ Use the organization resource as the root, create a folder per department, and put each department's projects in its folder :: The organization node holds company-wide IAM and organization policies, and folders let each department manage its own projects. Policies are inherited from organization to folders to projects.
- Create a separate organization for each department :: Separate organizations split policy management and make company-wide controls much harder. One organization per company is the recommended pattern.
- Put all projects directly under the organization and use labels to identify each department :: Labels help with cost reporting and filtering, but you can't use them as IAM or organization policy boundaries. Folders provide the delegation boundary.
> Organization → folders → projects → resources. Policies are inherited downward, so folders are the natural place to delegate administration.

### ace-1002 [1.1] d1 #projects
You created a project named "Payments Dev" with the project ID payments-dev-4821. A teammate wants to change the project ID to payments-development. What should you tell them?
- Run gcloud projects update payments-dev-4821 --project-id=payments-development :: No such flag exists. Once a project is created, its ID can't be changed.
- Change the ID in the console under IAM & Admin > Settings, then save :: The Settings page lets you edit the project name, not the project ID.
+ Explain that project IDs are permanent, and create a new project if the ID matters :: Project IDs are permanent and globally unique. Only the display name can be edited later.
- Delete the project and immediately create a new project with the same resources :: Deleting the project doesn't move resources, and a deleted project's ID can't be reused, so this doesn't help.
> Project name: editable. Project ID: permanent and globally unique. Project number: assigned by Google.

### ace-1003 [1.1] d2 #org-policy
Your security team requires that no Compute Engine VM in the organization have an external IP address, except for VMs in one approved project that hosts bastion hosts. What is the most efficient way to enforce this?
- Create a VPC firewall rule in every project that denies all ingress from 0.0.0.0/0 except the bastion :: Firewall rules control traffic, not whether a VM gets an external IP. You'd also have to maintain the rule in every project.
- Ask each project owner to remove external IPs, and audit every month with Cloud Asset Inventory reports :: Auditing finds violations after the fact. It doesn't prevent them.
+ Deny constraints/compute.vmExternalIpAccess at the organization, and allow the bastion VMs in that project :: The list constraint blocks external IPs everywhere through inheritance, and a project-level policy can allow specific instances. This is preventive and centrally managed.
- Create a custom IAM role without the compute.instances.create permission and assign it to all developers :: Removing create permission stops VM creation entirely rather than just blocking external IPs.
> Organization policies are preventive guardrails on resource configuration. IAM controls who can act, and org policies control what configurations are allowed.

### ace-1004 [1.1] d2 #org-policy #locations
Due to data residency regulations, all resources in your organization's "EU" folder must be created only in European regions. What should you do?
- Grant the EU team a custom role that excludes permissions for non-European regions :: IAM permissions aren't scoped by region, so you can't express this with a role.
- Require a region=eu label on every resource and alert on resources with non-compliant labels :: Labels don't enforce anything, and users can set any label value.
+ Apply constraints/gcp.resourceLocations on the EU folder with the in:eu-locations value group :: The resource locations constraint is inherited by every project in the folder and blocks creation of supported resources outside the allowed locations.
- Create a custom-mode VPC with only European subnets in every project in the EU folder :: Subnets limit where VMs can be placed in that network, but they don't stop regional or multi-regional services such as Cloud Storage or BigQuery from being created elsewhere.
> Use constraints/gcp.resourceLocations with value groups such as in:eu-locations for data residency.

### ace-1005 [1.1] d2 #org-policy #iam
Your company wants to make sure only identities from its own Cloud Identity domain (example.com) can be granted IAM roles on any resource. A developer was able to grant a role to a personal @gmail.com account. How do you prevent this in the future?
+ Enforce constraints/iam.allowedPolicyMemberDomains at the organization with only your customer ID :: This constraint limits which domains can appear in IAM allow policies. Once enforced, future grants to gmail.com and other outside domains are rejected.
- Remove the resourcemanager.projects.setIamPolicy permission from every developer :: Developers would lose the ability to manage any IAM policy, which is too broad. It also doesn't solve the underlying requirement for administrators.
- Enable Data Access audit logs and alert when a gmail.com principal is added :: This detects the problem after the fact but doesn't prevent it.
- Configure a VPC Service Controls perimeter around all projects that allows only example.com :: VPC Service Controls limit data exfiltration through Google APIs. They don't restrict which principals can appear in IAM policies.
> Domain restricted sharing (iam.allowedPolicyMemberDomains) restricts IAM grants to your own customer IDs.

### ace-1006 [1.1] d2 #org-policy
An organization policy at the organization level restricts allowed VM machine types. The data science folder needs to allow additional GPU machine types without affecting other folders. What should you do?
- Open a Google Cloud Support case to exempt the data science folder from the policy :: Exemptions are something you configure yourself through the policy hierarchy. Support isn't involved.
- Delete the organization-level policy and recreate the restriction on every other folder :: This works, but it's more effort and more error-prone than overriding only where needed.
+ Set a folder-level policy on data science that merges in the extra GPU machine types :: Organization policies can be customized at lower levels. A folder policy can inherit and add allowed values, or replace the parent's policy entirely, for just that subtree.
- Move the data science projects out of the organization so they have no policies :: Moving projects out of the organization removes all centralized governance and isn't a recommended practice.
> Child resources can inherit, merge with, or override parent organization policies, unless a managed constraint or the policy design prevents it.

### ace-1007 [1.1] d1 #apis
You just created a new project and run gcloud compute instances list. The command fails with an error saying the Compute Engine API has not been used in the project before or is disabled. What should you do?
- Grant yourself the Compute Admin role on the project :: The error is about the API being disabled, not about your permissions.
+ Run gcloud services enable compute.googleapis.com in the project :: Most Google Cloud APIs must be enabled per project before use. Enabling the Compute Engine API fixes this error.
- Create a service account and activate it with gcloud auth activate-service-account :: Switching identities doesn't help when the API itself is disabled.
- Reinstall the Google Cloud CLI with the compute component :: gcloud compute commands are part of the core CLI. The error comes from the project's API state, not the local installation.
> gcloud services enable SERVICE.googleapis.com, and gcloud services list --enabled shows what's on.

### ace-1008 [1.1] d1 #quotas
Your team needs to launch 200 vCPUs of N2 machines in us-central1 for a batch job, but VM creation fails with a QUOTA_EXCEEDED error for N2_CPUS. What should you do?
- Change the default region in gcloud to a region with more capacity :: That might move the workload, but it doesn't fix the quota in the region you need. Quotas are also per region, and the default region may be just as limited.
- Upgrade to Enhanced Support, which raises regional CPU quotas automatically :: Quota increases are requested through the quota system. They aren't tied to support plans.
+ Request an N2_CPUS quota increase for us-central1 on the Quotas & System Limits page :: Quotas are per project and usually per region. You can view current usage and submit an adjustment request from the console or the Cloud Quotas API.
- Create the VMs with Spot provisioning, because Spot VMs don't count toward quota :: Spot VMs still consume CPU quota (they can draw on preemptible quota where available). Spot doesn't bypass quotas.
> Quotas protect you and Google Cloud. They're scoped by project and usually by region, and you can request increases.

### ace-1009 [1.1] d2 #cloud-identity #users
Your company uses Microsoft Active Directory on-premises as the source of truth for employees. You want users and groups to be created and updated automatically in Cloud Identity so you can grant IAM roles to groups. What should you use?
- Ask each employee to sign up for a personal Google Account using their work email :: Unmanaged consumer accounts aren't controlled by your organization and won't stay in sync with AD.
+ Google Cloud Directory Sync (GCDS) to sync users and groups from Active Directory to Cloud Identity :: GCDS performs a one-way sync from AD/LDAP to Cloud Identity or Google Workspace, automating user and group lifecycle.
- Create users manually in the Admin console each week from an AD export :: This manual process is error-prone and doesn't scale.
- Configure Workforce Identity Federation and then create Cloud Identity accounts for each user :: Workforce Identity Federation's point is to avoid syncing identities into Cloud Identity at all. Combining it with manual account creation defeats the purpose.
> GCDS syncs AD/LDAP to Cloud Identity automatically. Pair it with SAML SSO so passwords stay in your IdP.

### ace-1010 [1.1] d2 #workforce-identity
Your organization uses Okta as its identity provider. The security team doesn't want to create or synchronize user accounts in Cloud Identity, but employees need to sign in to the Google Cloud console and use gcloud with their Okta identities. What should you configure?
- Workload Identity Federation with an Okta provider :: Workload Identity Federation is for workloads (applications and CI systems), not human users signing in to the console.
- A service account per employee, with keys distributed through Okta :: Service accounts are for workloads, and distributing keys to people is a serious security risk.
+ Workforce Identity Federation with an Okta provider in a workforce pool :: Workforce Identity Federation lets users authenticate with an external IdP and get access to Google Cloud without having Cloud Identity accounts.
- Google Cloud Directory Sync, using Okta as the LDAP source :: GCDS syncs from LDAP/AD into Cloud Identity, which is exactly what the security team wants to avoid.
> Workforce Identity Federation is for humans from an external IdP with no sync. Workload Identity Federation is for external workloads.

### ace-1011 [1.1] d1 #iam #groups
You manage 40 projects. The data analyst team (around 25 people) needs BigQuery Data Viewer on all projects in the "analytics" folder. People join and leave the team often. What is the recommended approach?
- Grant the role to each analyst individually on each of the analytics projects :: This means hundreds of bindings to maintain and is easy to get wrong when people change teams.
- Grant the role to each analyst at the organization level so it is inherited :: The scope is too broad, since analysts would get access to all projects, and you'd still manage individuals.
+ Grant the role to an analysts Google group on the analytics folder :: Grant roles to groups at the highest level that still respects least privilege. Membership changes then happen in one place, and the folder binding is inherited by every project.
- Create a service account for the team and share its key with the analysts :: Shared credentials remove accountability and are a security risk.
> Grant roles to groups, not individuals, and bind them at the folder level when many projects need the same access.

### ace-1012 [1.1] d2 #asset-inventory
A security auditor asks for a list of every Cloud Storage bucket in your organization, across hundreds of projects, including ones you didn't know about. What is the fastest way to produce this?
- Run gcloud storage buckets list in each project with a shell loop :: This works but is slow, and it needs project-level permissions everywhere and a complete project list.
+ Run gcloud asset search-all-resources at organization scope, filtered to buckets :: Cloud Asset Inventory indexes resources across the whole organization and can search or export them in one query.
- Export billing data to BigQuery and list every bucket that has Cloud Storage SKUs :: Billing data shows costs, not a reliable inventory, and empty buckets with no charges wouldn't appear.
- Query Cloud Logging across all projects for storage.buckets.create entries :: Audit logs have limited retention by default and miss buckets created before that window.
> Cloud Asset Inventory gives an organization-wide view of resources and IAM policies, with search, export, and change feeds.

### ace-1013 [1.1] d2 #asset-inventory
Your compliance team wants to be notified in near real time whenever an IAM policy changes on any project in the "production" folder. What should you set up?
- A daily Cloud Scheduler job that exports all IAM policies and compares them :: Daily polling isn't near real time and requires custom diff logic.
+ A Cloud Asset Inventory feed on the folder for IAM policies, publishing to Pub/Sub :: Asset feeds send change notifications for resources or IAM policies to Pub/Sub, and they can be scoped to a folder.
- A budget alert on the production folder that emails the compliance team :: Budgets track spending, not configuration changes.
- Enable Data Access audit logs on all services in the production folder :: IAM policy changes are already recorded in Admin Activity logs. Data Access logs don't help, and logs alone don't notify anyone.
> Asset feeds plus Pub/Sub give near-real-time notification of resource or IAM changes.

### ace-1014 [1.1] d1 #gemini-cloud-assist
You're new to a project and want to quickly understand which resources exist and get a natural-language summary of, for example, which VMs are running without recent CPU usage. Which Google Cloud capability is designed for this kind of AI-assisted analysis?
+ Gemini Cloud Assist :: Gemini Cloud Assist is an AI assistant in the console that can analyze your resources, summarize configurations, and help troubleshoot or optimize using natural-language prompts.
- Cloud Shell Editor :: Cloud Shell Editor is a browser-based code editor. It doesn't analyze your deployed resources.
- Cloud Deploy :: Cloud Deploy is a continuous delivery service for GKE, Cloud Run, and other targets, not an analysis assistant.
- Cloud Scheduler :: Cloud Scheduler is a managed cron service.
> Gemini Cloud Assist answers questions about your Google Cloud resources, investigates issues, and suggests optimizations.

### ace-1015 [1.1] d2 #observability
Your company has 12 application projects. The operations team wants a single place to see Cloud Monitoring dashboards and alerts for VMs in all 12 projects. What should you do?
- Create a dashboard in each project and bookmark them all :: This doesn't give a combined view or allow alerting across projects.
+ Create (or choose) a scoping project and add the 12 projects to its metrics scope :: A metrics scope lets one scoping project view and alert on metrics from multiple monitored projects.
- Export all metrics to BigQuery and build dashboards in Looker Studio :: This adds cost and latency and isn't the native way to monitor multiple projects.
- Move all 12 projects' VMs into a single project :: Consolidating workloads to get monitoring is disruptive and unnecessary.
> A metrics scope (on a scoping project) aggregates monitoring for multiple projects.

### ace-1016 [1.1] d1 #regions #zones
Before designing a deployment, you need to confirm that the a3-highgpu-8g machine type is available in europe-west4-a. Which command gives the most direct answer?
- gcloud compute regions describe europe-west4 --format=json :: This shows regional quotas and status, not machine-type availability per zone.
+ gcloud compute machine-types list --filter="zone:europe-west4-a" :: Machine type availability is zonal, and this lists the machine type if it's offered in that zone.
- gcloud compute zones list --filter="name:europe-west4-a" :: This confirms the zone exists but says nothing about which machine types it offers.
- gcloud services list --available --filter="name:compute" :: This lists APIs, not regional capacity or machine types.
> Product and machine-type availability varies by region and zone. Check it before you design.

### ace-1017 [1.1] d2 #iam #projects
A new team member must be able to create projects in the "sandbox" folder but must not be able to modify IAM on other folders. Which role should you grant, and where?
- Organization Administrator on the organization :: This is far too much privilege, since it allows managing IAM on the whole organization.
+ Project Creator on the sandbox folder :: Project Creator grants resourcemanager.projects.create, and binding it on the folder limits project creation to that folder.
- Folder Admin on the organization :: This lets them manage all folders, including their IAM.
- Owner on an existing sandbox project :: Owner on a single project doesn't allow creating new projects in the folder.
> Bind roles at the narrowest resource that meets the need. Project Creator on a folder allows creating projects only there.

### ace-1018 [1.1] d2 #projects
A developer accidentally deleted an important project 10 days ago. What can you do?
- Nothing. Project deletion is immediate and permanent :: Deletion isn't immediate. Projects enter a pending-deletion (shutdown) state first.
+ Run gcloud projects undelete, since deleted projects are recoverable for about 30 days :: Deleted projects are shut down and marked for deletion, and an owner can restore them during the roughly 30-day window.
- Open a support case to recover it from Google's backups after 60 days :: The recovery window is about 30 days, and you can do it yourself.
- Create a new project with the same project ID and restore resources from snapshots :: Project IDs can't be reused, even after deletion.
> Deleted projects can be restored for about 30 days with gcloud projects undelete.

### ace-1019 [1.1] d2 #networking #org-policy
Every new project in your organization automatically gets a "default" VPC network with permissive firewall rules, which the security team dislikes. How can you stop the default network from being created in new projects?
- Delete the default network in each new project after it's created :: This is reactive and easy to forget.
+ Enforce constraints/compute.skipDefaultNetworkCreation at the organization :: When this boolean constraint is enforced, new projects are created without the default network.
- Create a firewall rule at the organization level that denies all traffic :: The default network would still be created, and blocking all traffic would break legitimate workloads.
- Disable the Compute Engine API at the organization level :: You can't do that, and you'd lose all VM functionality anyway.
> Use the skipDefaultNetworkCreation constraint, then create custom-mode VPCs on purpose.

### ace-1020 [1.1] d1 #gcloud #configurations
You regularly switch between a development project in us-east1 and a production project in europe-west1, each with a different account. What's the most convenient way to manage this in the gcloud CLI?
+ Create a named gcloud configuration for each environment and activate the one you need :: Named configurations store properties such as account, project, and compute/region, and you can switch between them instantly.
- Run gcloud init every time you switch and answer the prompts again :: gcloud init works, but rerunning the interactive setup each time is slow and unnecessary.
- Install two copies of the Google Cloud CLI in separate folders, one per account :: That's unnecessary, since configurations exist for exactly this case.
- Add --project and --region flags to every command and log in again each time :: This is tedious and error-prone. Configurations handle it for you.
> gcloud config configurations let you switch account, project, and region in one step.

### ace-1021 [1.1] d2 #iam #org
Your organization was just created when you verified your Cloud Identity domain. No one can create folders yet. Who should grant folder-management permissions, and what's a good first step?
- Any project owner, by granting Folder Admin on their project :: Folder Admin isn't meaningful at the project level, and project owners can't manage organization-level IAM.
+ A Cloud Identity Super Admin, who grants Organization Administrator to cloud admins :: When an organization is created, Super Admins can assign the Organization Administrator role, and Organization Administrators then manage IAM for the hierarchy.
- Google Cloud Support, by opening a ticket to bootstrap folder permissions :: Google Support doesn't grant IAM roles in your organization.
- The billing account administrator, by linking a billing account :: Billing roles don't grant resource hierarchy permissions.
> The Cloud Identity Super Admin bootstraps the organization by granting Organization Administrator to cloud admins (preferably groups).

### ace-1022 [1.1] d2 #iam #basic-roles
A contractor needs to view all resources in a project but must not be able to change anything or see data inside Cloud Storage objects or BigQuery tables. Which choice best follows least privilege?
- Owner, with the contractor asked not to make changes :: Owner grants full control, including IAM changes.
- Editor, limited by an IAM condition to read-only methods :: Editor allows modifying most resources.
+ Narrow predefined viewer roles or a custom role with only metadata permissions :: The basic Viewer role includes read access to data in many services. Combining narrower predefined roles, or building a custom role, limits access to metadata.
- Security Reviewer only, granted on the contractor's project :: Security Reviewer allows listing IAM policies but doesn't grant viewing of all resources.
> Basic roles are broad. Viewer can read data in many services, so prefer predefined or custom roles.

### ace-1023 [1.1] d1 #labels
The finance team wants to break down Google Cloud costs by team and environment across many projects. What's the simplest way to make this possible?
- Create a separate billing account for each team :: Multiple billing accounts make invoicing and discounts harder. Labels are simpler.
+ Apply team and env labels to resources and group costs by label in billing reports :: Labels are key-value pairs that flow into billing data and can be used for filtering and grouping costs.
- Add team and env network tags to every VM and filter billing reports by tag :: Network tags are used by firewall rules and routes. They don't appear in billing data.
- Name every resource with a team prefix and parse names in a spreadsheet :: This relies on naming discipline and manual work, while labels give native cost breakdown.
> Labels are for cost allocation and filtering. Network tags are for firewall and route targeting.

### ace-1024 [1.1] d2 #iam #tags
Your security team wants to conditionally allow a group to administer only VMs in projects tagged as environment=dev, and to use the same tag with organization policies. Which feature supports this?
- Labels on the projects and VMs :: Labels are metadata for organization and billing. You can't use them in IAM conditions or organization policy conditions.
+ Resource Manager tags (secure tags) :: Tags are created at the organization or project level, attached to resources, and inherited. IAM conditions and organization policies can use them to grant or enforce conditionally.
- Network tags on the VMs :: Network tags apply only to VM firewall and route targeting.
- Folder display names in conditions :: You can't use folder display names as conditions.
> Resource Manager tags (secure tags) support IAM conditions, org policy conditions, and Cloud NGFW targeting. Labels don't.

### ace-1025 [1.1] d2 #quotas #monitoring
You want to be alerted before your project runs out of a regional quota (for example, in-use IP addresses), so you can request an increase in time. What should you do?
+ Create a Cloud Monitoring alerting policy on quota usage as a ratio of the limit, at 80% :: Quota usage and limits are exported as Cloud Monitoring metrics, so you can alert before you hit the limit.
- Create a billing budget for the project with an alert threshold at 80% :: Budgets track spend, not resource quotas.
- Check the Quotas & System Limits page every week and export the results :: Manual checks can miss sudden growth, while alerts are proactive.
- Enable Data Access audit logs for Compute Engine and alert on address creation :: Audit logs record API calls but don't show quota consumption trends.
> Alert on quota metrics in Cloud Monitoring to stay ahead of quota limits.

### ace-1026 [1.1] d3 #org-policy #dry-run
You plan to enforce a new organization policy that blocks service account key creation across the organization. You're worried it will break existing automation. What's the safest way to roll this out?
- Enforce it at the organization level immediately and fix whatever breaks :: Enforcing without assessment risks outages.
+ Create the policy in dry-run mode, fix the workloads it flags, then enforce it :: Dry-run organization policies log violations without blocking, which lets you assess impact before enforcing.
- Apply it only to a single test project forever :: A single project doesn't give organization-wide protection.
- Remove the iam.serviceAccountKeys.create permission from all roles with a script :: You can't change predefined roles, and this is the wrong tool.
> Use dry-run organization policies or Policy Simulator to safely assess a constraint before enforcing it.

### ace-1027 [1.1] d1 #projects
Which statement best describes the relationship between projects and resources in Google Cloud?
- A resource can belong to several projects at the same time :: Each resource belongs to exactly one project, though Shared VPC lets other projects use a host project's network.
+ Each resource belongs to one project, where APIs and billing are managed :: Projects organize resources and are where APIs are enabled and billing is attached.
- Projects are optional. Resources can exist directly under folders :: Most resources must live inside a project. Folders contain projects, not resources.
- A project can be linked to multiple billing accounts at once :: A project is linked to at most one billing account at a time.
> Projects are the base unit for APIs, billing, quotas, and most IAM.

### ace-1028 [1.1] d2 #cloud-identity #sso
Your company syncs AD users to Cloud Identity with GCDS. Users complain about having two passwords. What should you configure?
- Sync password hashes with GCDS and have users reset passwords monthly :: Users would still manage credentials in Google, and the complaint remains.
+ SAML single sign-on in Cloud Identity, with your corporate IdP as the provider :: With SSO, Cloud Identity redirects authentication to your IdP, so users have one corporate password.
- Workload Identity Federation with Active Directory as the provider :: That's for workloads, not user sign-in.
- Disable 2-step verification for all synced users so sign-in is faster :: This weakens security and doesn't remove the second password.
> GCDS handles provisioning and SAML SSO handles authentication. Together they give users one identity.

### ace-1029 [1.1] d2 #apis #services
You want to see all APIs that are currently enabled in your project and then disable the unused Cloud Translation API. Which commands should you use?
+ gcloud services list --enabled, then gcloud services disable translate.googleapis.com :: These commands list enabled services and disable a specific one in the active project.
- gcloud apis list, then gcloud apis remove translate :: These aren't valid gcloud command groups.
- gcloud projects describe, then gcloud projects update --disable-api=translate :: Project describe doesn't show enabled APIs, and there's no such update flag.
- gcloud components list, then gcloud components remove translate :: Components are local CLI parts, not project APIs.
> gcloud services list --enabled, gcloud services enable, and gcloud services disable manage project APIs.

### ace-1030 [1.1] d3 #org-policy #custom-constraint
Your organization wants to prevent anyone from creating GKE clusters that don't have Workload Identity Federation for GKE enabled. No predefined organization policy constraint covers this exact setting. What should you do?
- Use Cloud Asset Inventory to detect noncompliant clusters and delete them daily :: This is reactive cleanup, not prevention.
+ Create and enforce a custom organization policy constraint on the cluster's workload identity field :: Custom constraints let you write conditions on supported resource fields (including many GKE fields) to allow or deny create and update operations.
- Grant developers a custom IAM role that excludes container.clusters.create :: This blocks all cluster creation, not just noncompliant clusters.
- Set a budget alert on GKE that fires when a noncompliant cluster is created :: Budgets don't enforce configuration.
> Custom organization policy constraints (CEL on resource fields) cover settings that predefined constraints don't.

### ace-1031 [1.1] d1 #cloud-shell
A colleague needs to run gcloud and kubectl commands from a locked-down laptop where they can't install software. What's the quickest option?
- Use a Compute Engine VM with an external IP and install tools there :: This works but takes setup, costs money, and exposes a VM.
+ Use Cloud Shell in the console, where gcloud and kubectl are preinstalled :: Cloud Shell is a free browser-based shell with a persistent 5 GB home directory and preinstalled tools.
- Set up Cloud Workstations with a custom image that includes the CLI tools :: This is powerful but heavier than needed for quick CLI access.
- Install the Cloud SDK in a Docker container on the laptop :: They can't install software, so Docker is ruled out too.
> Cloud Shell gives a ready-to-use, authenticated CLI environment in the browser.

### ace-1032 [1.1] d2 #hierarchy #iam
A user has the Compute Admin role granted on folder "engineering" and the Compute Viewer role on project "eng-web", which is in that folder. What effective access does the user have on eng-web?
- Compute Viewer only, because the project-level binding overrides the folder :: IAM allow policies are additive. A lower-level grant doesn't remove inherited permissions.
+ Compute Admin, because inherited and project grants are combined :: Permissions granted higher in the hierarchy are inherited, so the user gets the union of both roles.
- No compute access, because the conflicting roles cancel out :: Roles never cancel each other out. Only deny policies can remove permissions.
- Compute Admin only on resources created after the folder binding :: Inheritance applies to all resources regardless of when they were created.
> Allow policies are additive and inherited. Only IAM deny policies can subtract permissions.

### ace-1033 [1.1] d3 #iam #deny
A group has Editor inherited from the organization. You need to make sure nobody in that group can delete Cloud SQL instances in the "finance-prod" project, without changing the organization-level grant. What should you use?
- A project-level allow policy granting Cloud SQL Viewer to the group :: Allow policies are additive. Viewer doesn't remove the inherited Editor permissions.
+ An IAM deny policy on the finance-prod project that denies cloudsql.instances.delete for the group :: Deny policies are evaluated before allow policies and override any granted permissions for the specified principals.
- An organization policy that disables Cloud SQL :: That blocks the whole service, which isn't the requirement.
- Remove the group from the organization and add it back to each project except finance-prod :: That changes the organization-level grant, which the requirement says not to do, and it means a lot of rework.
> IAM deny policies block specific permissions for principals regardless of allow grants.

### ace-1034 [1.1] d2 #networking #setup
You're setting up networking for a new environment. You need full control over subnet IP ranges so they don't overlap with on-premises networks you'll connect to later. Which VPC mode should you choose?
- Auto mode VPC :: Auto mode creates one subnet per region from a fixed 10.128.0.0/9 range, which may overlap with on-premises ranges.
+ Custom mode VPC :: Custom mode lets you choose which regions get subnets and exactly which IP ranges they use.
- Legacy network :: Legacy networks are deprecated and have no subnets.
- Default network :: The default network is an auto mode VPC with permissive default firewall rules.
> Use custom mode VPCs in production so you control the IP plan. You can convert auto mode to custom, but not back.

### ace-1035 [1.1] d2 #essential-contacts
Your organization wants security bulletins and technical notifications from Google Cloud to reach the security team's mailing list instead of individual project owners. What should you configure?
- A Cloud Monitoring notification channel set to the security mailing list :: Monitoring channels deliver your alerts, not Google's account notifications.
+ Essential Contacts at the organization for the Security and Technical categories :: Essential Contacts route Google Cloud notifications by category to the right people or groups, and they're inherited down the hierarchy.
- A Pub/Sub topic subscribed to Google's release notes :: That isn't how account notifications are delivered.
- Grant the security team the Owner role on all projects :: This is overprivileged and doesn't route notifications reliably.
> Essential Contacts route Google Cloud notifications (billing, security, technical, legal) to the right teams.

### ace-1036 [1.1] d2 #service-health
Your operations team wants to know automatically when a Google Cloud incident affects the products and regions their projects use, and to see this in one console page. What should they use?
- The public Google Cloud Status Dashboard only :: The public dashboard isn't personalized to your projects and can't send notifications for your specific resources.
+ Personalized Service Health with incident alerts :: Personalized Service Health shows incidents that affect your projects and integrates with alerts and notifications.
- Cloud Trace with latency alerts :: Cloud Trace analyzes application latency, not Google platform incidents.
- Recommender insights for each project :: Recommender gives optimization suggestions, not incident notifications.
> Personalized Service Health is project-relevant incident visibility and alerting.

### ace-1037 [1.2] d1 #billing
You created a new project, but you can't create any Compute Engine VMs. The console says billing must be enabled. What should you do?
- Grant yourself the Compute Admin role :: The issue is billing, not permissions.
+ Link the project to a billing account :: Many services, including Compute Engine, require the project to be linked to a billing account.
- Enable the Cloud Billing API only :: Enabling the API doesn't link a billing account.
- Request a Compute Engine quota increase :: Without billing, you can't use the service at all, so quota isn't the issue.
> Billable services require the project to be linked to an active billing account.

### ace-1038 [1.2] d2 #billing #iam
A developer has the Owner role on a project and wants to link it to the company's billing account, but the operation fails. What additional permission do they most likely need?
- Billing Account Viewer on the billing account :: Viewer can't link projects.
+ Billing Account User on the billing account :: Linking requires permissions on both sides: on the project (Owner or Project Billing Manager) and on the billing account (Billing Account User or Administrator).
- Organization Administrator on the organization :: This doesn't include billing account permissions.
- Project Billing Manager on the organization :: Project Billing Manager covers the project side, which Owner already has. The missing permission is on the billing account.
> Linking a project needs permission on the project and on the billing account (Billing Account User).

### ace-1039 [1.2] d2 #budgets
Your manager asks that the team get an email when this month's spending on the "ml-research" project reaches 50%, 90%, and 100% of $2,000, and also when forecasted spend is expected to exceed $2,000. What should you do?
+ A $2,000 project budget with actual thresholds at 50/90/100% and a forecasted one at 100% :: Budgets support both actual and forecasted thresholds and email billing admins or other configured recipients.
- Create a Cloud Monitoring alert when the project's total CPU utilization passes 90% :: CPU utilization isn't spend.
- Set a $2,000 quota cap on the project's billable services :: Quotas limit resource usage, not dollars, and don't send budget emails.
- Export billing to BigQuery and check it manually each week :: This isn't automated or timely.
> Budgets alert on actual or forecasted spend, and they don't stop spending by themselves.

### ace-1040 [1.2] d3 #budgets #automation
A research project must never exceed $500 per month. Exceeding it, even briefly, is unacceptable, and the team accepts that services will stop. What's the recommended way to implement this?
- Create a budget with a 100% threshold. Google Cloud automatically stops services when the budget is reached :: Budgets only notify. They don't cap or stop spending.
+ Send budget notifications to Pub/Sub and have a function disable billing at the threshold :: Programmatic budget notifications can trigger automation, such as disabling billing, to cap costs. Note that cost data has some delay.
- Set a project quota of 500 "dollars per month" for all services :: No such quota exists. Quotas limit resource counts and rates, not money.
- Buy committed use discounts sized to $500 per month :: Commitments reduce prices but don't cap spending.
> Budgets notify, and they automate only through Pub/Sub plus a function you write. Disabling billing stops paid services.

### ace-1041 [1.2] d2 #billing-export
The finance team wants to analyze detailed, resource-level Google Cloud costs with SQL and build dashboards. What should you set up?
- Download the PDF invoice each month and import it into a spreadsheet :: Invoices aren't granular and the process is manual.
+ Detailed Cloud Billing export to BigQuery, queried with SQL :: The detailed export includes resource-level cost data in BigQuery for SQL analysis and dashboards.
- Cloud Logging sink of billing logs to Cloud Storage :: Billing data isn't exported through log sinks.
- Cloud Asset Inventory export to BigQuery, joined with prices :: Asset inventory has resource metadata, not costs.
> Enable billing export to BigQuery early. Exports start from when they're enabled.

### ace-1042 [1.2] d2 #billing #iam
An accountant must be able to see costs and invoices for the billing account but must not be able to change payment methods or link projects. Which role is appropriate?
- Billing Account Administrator :: Administrators can manage payment methods and link projects.
- Billing Account User :: Billing Account User allows linking projects to the account.
+ Billing Account Viewer :: Viewer can see cost information and transactions without modifying the billing account.
- Project Billing Manager :: This role manages project-billing linkage, not cost viewing on the account.
> Billing Account Administrator manages everything, Billing Account User links projects, and Billing Account Viewer only reads.

### ace-1043 [1.2] d2 #billing
Your company wants to move a project from an old team's billing account to the central finance billing account without downtime. What should you do?
- Delete and recreate the project under the new billing account :: This is disruptive, and the project ID can't be reused.
+ Link the project to the central billing account with gcloud billing projects link :: Changing a project's billing account doesn't interrupt running resources, as long as the new account is active.
- Create a billing subaccount and migrate resources one by one :: Subaccounts are for resellers, and moving resources between projects isn't required.
- Open a support case to transfer the project between billing accounts :: You can do this yourself with the right billing permissions.
> gcloud billing projects link PROJECT_ID --billing-account=ACCOUNT_ID changes the billing account without downtime.

### ace-1044 [1.2] d1 #billing-reports
You want a quick visual of which services drove last month's cost increase, without setting up any exports. Where should you look?
- Cloud Monitoring dashboards :: These show performance metrics, not costs.
+ Cloud Billing Reports, grouped by service :: Billing Reports provide built-in cost visualization with grouping and filtering.
- Cloud Logging Logs Explorer :: Logs don't show costs.
- Cloud Asset Inventory change history :: Asset Inventory shows resources, not spend.
> Billing Reports are for quick visual analysis. BigQuery export is for deep or custom analysis.

### ace-1045 [1.2] d2 #budgets
You created a budget for a billing account, but the engineering leads (who aren't billing administrators) say they never receive budget emails. What should you do?
- Grant them Billing Account Administrator :: This is excessive privilege just to receive alerts.
+ Connect Cloud Monitoring notification channels to the budget :: By default, budget emails go to billing admins and users. You can add Monitoring notification channels to reach other recipients.
- Add them as Owners of the projects the budget covers :: Owners don't automatically receive billing-account budget emails, and Owner is overprivileged.
- Create a log-based metric on budget events and alert the leads on it :: Budgets don't generate logs you can alert on that way.
> Budget alerts can notify extra recipients through Cloud Monitoring notification channels.

### ace-1046 [1.2] d2 #billing-account
A startup is ready for production and wants to be billed monthly by invoice instead of by credit card. What type of Cloud Billing account do they need?
- Self-serve (online) billing account :: Self-serve accounts are charged automatically to a card or bank account.
+ An invoiced (offline) billing account :: Invoiced billing is for eligible businesses, with monthly invoices paid by check or wire transfer.
- A billing subaccount under a reseller :: Subaccounts are for resellers.
- A free-trial account upgraded to paid :: Free-trial accounts can't be invoiced.
> Self-serve billing is charged to a card or bank account. Invoiced billing is paid by invoice and requires approval.

### ace-1047 [1.2] d3 #billing-export #labels
After enabling the BigQuery billing export, finance notices that costs for some VMs don't show the team label they expected. The labels were added to the VMs yesterday. What's the most likely explanation?
- Labels on VMs never appear in billing exports :: Resource labels do appear in billing data for supported resources.
+ Labels apply only to usage recorded after they're added :: Billing data reflects the labels present when the usage occurred, and isn't rewritten retroactively.
- Billing export only shows project labels :: Resource labels are included for supported resources.
- They must enable Data Access audit logs for Compute Engine first :: Audit logs aren't related to cost labels.
> Labels in billing data apply only from when the label is added, so label resources early.

### ace-1048 [1.2] d1 #pricing-calculator
Before migrating, you want to estimate the monthly cost of 10 n2-standard-4 VMs, 2 TB of Standard Cloud Storage, and a Cloud SQL instance. What should you use?
+ The Pricing Calculator :: The Pricing Calculator estimates costs for planned configurations before you deploy.
- Cloud Billing Reports :: Billing Reports show historical spend, not hypothetical estimates.
- Recommender cost insights :: Recommender analyzes existing resources for savings.
- Cloud Asset Inventory :: Asset Inventory lists existing resources.
> Pricing Calculator is for planning, Billing Reports show actuals, and Recommender helps optimize.

### ace-1049 [1.1] d2 #iam #org
You want to allow a group of platform engineers to create and manage folders under the organization, but not grant IAM permissions on projects. Which role should you grant at the organization level?
- Organization Administrator :: This includes setting IAM on the organization and its resources, which is more than required.
+ Folder Creator or Folder Editor :: Folder roles control folder creation and management without broad project IAM permissions.
- Project IAM Admin on the organization :: This manages project IAM, which is the opposite of the requirement.
- Owner on every project :: This grants far more than needed.
> Use the specific Resource Manager roles (Folder Creator, Folder Editor, Project Creator) instead of Organization Administrator when possible.

### ace-1050 [1.1] d3 #multiple #setup
You're preparing a new Google Cloud organization for enterprise use. Which two actions are recommended early on? (Choose two.)
+ Grant administrative roles to groups instead of individual users :: Groups simplify access management and auditing as staff change.
- Grant the Owner role to all developers at the organization level so they aren't blocked :: Broad Owner grants violate least privilege and are a major risk.
+ Set baseline organization policies, such as disabling service account key creation and restricting resource locations :: Organization policies create preventive guardrails across the hierarchy from day one.
- Keep every workload in a single project to simplify billing :: A single project removes isolation and IAM boundaries. Labels and billing export handle cost analysis.
- Use the default network in production projects to save time :: The default network has broad firewall rules and an auto-mode IP plan, so it's not suited to production.
> Early guardrails: groups for IAM, baseline org policies, custom VPCs, and a folder structure.
