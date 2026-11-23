// Section 4: Configuring access and security (~20%)
// 4.1 IAM, 4.2 service accounts

### ace-4001 [4.1] d1 #iam-policy
You need to see who has which roles on the project "web-prod". Which command shows the project's IAM allow policy?
+ gcloud projects get-iam-policy web-prod :: This prints the project's bindings (roles to principals) and its etag.
- gcloud iam roles list --project=web-prod :: This lists custom roles defined in the project, not who has them.
- gcloud projects describe web-prod :: This shows project metadata, not IAM bindings.
- gcloud iam service-accounts list :: This lists service accounts only.
> get-iam-policy shows who has access, iam roles list shows role definitions, and add-iam-policy-binding grants access.

### ace-4002 [4.1] d1 #iam-binding
You need to grant the user ana@example.com the Storage Object Viewer role on project "media-prod". Which command should you use?
- gcloud projects set-iam-policy media-prod --member=user:ana@example.com --role=roles/storage.objectViewer :: set-iam-policy replaces the whole policy from a file. It doesn't take member and role flags.
+ gcloud projects add-iam-policy-binding media-prod --member=user:ana@example.com --role=roles/storage.objectViewer :: add-iam-policy-binding adds a single binding without overwriting the rest of the policy.
- gcloud iam roles create viewer --member=ana@example.com :: That creates custom roles. It doesn't grant them.
- gcloud storage buckets add-iam-policy-binding media-prod --member=ana :: Bucket-level bindings take a bucket URL, and the member needs a user: prefix.
> Use add-iam-policy-binding or remove-iam-policy-binding for single changes, and set-iam-policy (with an etag) for full replacement.

### ace-4003 [4.1] d2 #etag
Two administrators edited the same project IAM policy at the same time with get-iam-policy and set-iam-policy, and one admin's change was rejected. Why does this happen, and what is it protecting?
+ The policy's etag changed after it was read, which prevents a lost update :: The etag provides optimistic concurrency control. The admin should re-read the policy, re-apply the change, and try again.
- IAM allows only one admin session per project at a time :: Many admins can manage IAM at the same time.
- set-iam-policy only works from Cloud Shell, not local gcloud :: It works from any authenticated environment.
- Policies are locked for 24 hours after each change :: There's no such lock.
> The etag prevents lost updates. Re-read the policy before setting it.

### ace-4004 [4.1] d2 #role-types
Which statement about IAM role types is correct?
- Basic roles are recommended for production because they're simple :: Basic roles (Owner, Editor, Viewer) are very broad and not recommended for production.
+ Predefined roles are maintained by Google, and custom roles hold only what you choose :: Use predefined roles first, and custom roles when you need tighter least privilege.
- Custom roles can be created at the folder level and inherited by its projects :: Custom roles can be created only at the organization or project level.
- Predefined roles can be edited to remove permissions :: You can't modify predefined roles. Copy one into a custom role instead.
> Basic is broad, predefined is service-specific and maintained by Google, and custom is yours (organization or project level).

### ace-4005 [4.1] d2 #custom-roles
The audit team needs a role that's the same as the predefined Compute Viewer role but without the permission to read serial port output. What's the fastest way to create it?
- Edit roles/compute.viewer and remove the permission :: Predefined roles can't be modified.
+ Copy Compute Viewer into a custom role and remove that permission :: Copying a predefined role is the quickest starting point for a custom role.
- Grant Compute Viewer and an IAM deny policy for everything else :: Deny policies can block specific permissions, but the request is for a reusable role.
- Use the basic Viewer role at the project level :: Viewer is broader and still includes the permission.
> gcloud iam roles copy, then gcloud iam roles update --remove-permissions, gives a custom role derived from a predefined one.

### ace-4006 [4.1] d3 #custom-roles #lifecycle
You created a custom role at the organization level and later realize it grants too much. You want to stop it from granting access immediately, but keep the option to restore it. What should you do?
- Delete the role permanently with gcloud :: Deleted roles stay recoverable for a while, but disabling is the clearer reversible step that the requirement describes.
+ Set the custom role's stage to DISABLED :: A disabled custom role stays in policies but grants no permissions, and you can re-enable it later.
- Remove the role from the organization's policy cache :: There's no such operation.
- Rename the role so existing bindings no longer match :: Renaming doesn't affect permissions granted.
> Custom role stages are ALPHA, BETA, GA, DEPRECATED, and DISABLED. DISABLED stops granting permissions without deleting the role.

### ace-4007 [4.1] d2 #inheritance
You grant a group the BigQuery Data Viewer role on folder "analytics". Which statement is true?
- Only projects created after the grant get the access :: Inheritance applies to existing and future projects.
+ The group can read BigQuery data in every project in the folder :: Grants at a folder apply to everything beneath it.
- The grant has no effect until you also grant it on each dataset :: Folder grants are inherited without per-dataset bindings.
- Project owners can block the inherited grant with a lower-level allow policy :: Allow policies are additive. Only deny policies, or changes at the folder, would block it.
> Grant at the highest level that's still least privilege, because grants flow down to every child resource.

### ace-4008 [4.1] d2 #conditions #temporary
A contractor needs Compute Instance Admin on a project only until the end of the month, and you want access removed automatically. What should you do?
- Grant the role and set a calendar reminder to remove it :: This is manual and easy to forget.
+ Add the binding with an IAM condition that expires at month end :: IAM Conditions can make bindings time-limited, so they stop granting access automatically.
- Create a custom role with a TTL that ends at month end :: Roles have no TTL. Time limits are expressed with conditions.
- Create a service account and share its key until the end of the month :: This shares credentials and is insecure.
> Temporary access uses IAM conditions with request.time, or Privileged Access Manager for just-in-time access.

### ace-4009 [4.1] d3 #pam
Your operations engineers occasionally need Project Owner on production for emergencies. Security wants them to have no standing access, to request elevation with a justification, to get approval, and to have it expire automatically after 2 hours. What should you use?
+ Privileged Access Manager entitlements with approval :: PAM provides just-in-time, temporary, approved elevation with full auditing.
- Grant Owner permanently and monitor audit logs :: This is standing privilege, which violates the requirement.
- Share a break-glass Owner account password in a vault :: Shared accounts hurt accountability. PAM is the managed approach.
- An IAM deny policy that is removed during emergencies :: This is manual and doesn't provide approval workflows.
> PAM provides just-in-time, approved, time-boxed privileged access.

### ace-4010 [4.1] d2 #iam-recommender
After a year, many users hold roles with far more permissions than they actually use. You want data-driven suggestions to reduce them. What should you use?
- Cloud Asset Inventory exports :: These show bindings but not which permissions are actually used.
+ IAM Recommender role recommendations :: The IAM Recommender analyzes about 90 days of usage and recommends removing or replacing roles.
- Billing Reports by principal :: These show costs.
- Uptime checks on IAM APIs :: These are for availability.
> IAM Recommender right-sizes access based on actual permission usage.

### ace-4011 [4.1] d2 #policy-troubleshooter
A user says they get "permission denied" when trying to start a VM, but their manager believes they were granted access. How can you quickly find out why?
+ Run Policy Troubleshooter for compute.instances.start on the VM :: Policy Troubleshooter evaluates allow and deny policies and explains which bindings grant or block the permission.
- Ask the user to sign out and back in repeatedly :: Session refresh rarely fixes IAM issues, and it doesn't explain the cause.
- Grant Owner to the user temporarily and see if it works :: This is overprivileged and hides the real issue.
- Check Cloud Trace for the denied API call :: Trace doesn't analyze IAM.
> Policy Troubleshooter answers "why can or can't this principal do X on Y?". Policy Analyzer answers "who can access what?".

### ace-4012 [4.1] d2 #policy-analyzer
An auditor asks: "Which principals can delete objects in bucket gs://payroll, including access inherited from folders and the organization?" Which tool answers this most directly?
- gcloud storage buckets get-iam-policy on gs://payroll :: This shows only bucket-level bindings, not inherited ones.
+ Policy Analyzer for storage.objects.delete on the bucket :: Policy Analyzer evaluates the effective policy across the hierarchy and lists the principals who have the permission.
- Policy Troubleshooter for the bucket :: Troubleshooter checks one principal at a time, while Analyzer lists all of them.
- Cloud Logging Data Access logs :: Logs show past actions, not current access.
> Policy Analyzer lists everyone who can perform an action, including inherited access.

### ace-4013 [4.1] d1 #principals
You want any authenticated or unauthenticated user on the internet to be able to read objects in a public-assets bucket. Which principal identifier represents this?
- allAuthenticatedUsers :: This covers only users signed in with a Google account (not truly public), and its use is generally discouraged.
+ allUsers :: allUsers represents anyone on the internet, authenticated or not. Use it carefully, ideally only on dedicated public buckets.
- domain:example.com :: This covers all users in your domain.
- serviceAccount:public@... :: There's no such universal account.
> allUsers is public. Public access prevention or organization policy can block it on sensitive buckets.

### ace-4014 [4.1] d2 #least-privilege #bigquery
A data analyst needs to run queries in project "analytics" against a dataset in project "warehouse", but must not modify data. Which grants follow least privilege?
- BigQuery Admin on both projects, with an audit alert :: This is far too much privilege.
+ Job User on analytics and Data Viewer on the warehouse dataset :: Running queries needs bigquery.jobs.create in the project that runs the job, and reading needs data viewer access on the dataset.
- BigQuery Data Editor on warehouse only :: This allows modifications and doesn't allow running jobs in analytics.
- Viewer on both the analytics and warehouse projects :: Basic Viewer may not include job creation and is too broad.
> BigQuery separates running jobs (Job User, in the project) from reading data (Data Viewer, on the dataset).

### ace-4015 [4.1] d2 #logs #iam
An engineer can see Admin Activity audit logs but not Data Access audit logs for the project. They hold the Logs Viewer role. What role do they need?
- Logs Writer :: This writes logs. It doesn't read them.
+ Private Logs Viewer :: Data Access logs are considered private and require privateLogViewer, which includes Logs Viewer permissions plus access to private logs.
- Monitoring Viewer :: This is for metrics, not logs.
- Security Reviewer :: This lists IAM policies and doesn't read private logs.
> Logs Viewer reads most logs. Data Access logs require Private Logs Viewer.

### ace-4016 [4.1] d3 #multiple #iam
Which two are IAM best practices on Google Cloud? (Choose two.)
+ Grant roles to groups instead of individual users :: Groups make access management scalable and auditable.
- Use the Owner basic role for all administrators to avoid permission errors :: Owner is very broad and violates least privilege.
+ Prefer predefined roles, and use custom roles when predefined roles grant more than needed :: This balances maintainability with least privilege.
- Grant roles at the organization level whenever possible to simplify management :: Grant at the lowest level that meets the need, since organization-level grants affect everything.
- Share service account keys among team members for convenience :: Shared keys are a security risk. Use impersonation instead.
> Groups, least privilege, predefined before custom, and the right scope.

### ace-4017 [4.1] d2 #bucket-iam
A team needs to upload objects to a single bucket "uploads-prod", but must not list or read other buckets in the project. Where and what should you grant?
- Storage Admin on the project :: This covers all buckets with full control.
+ Storage Object Creator on the uploads-prod bucket :: Bucket-level bindings limit access to that bucket, and Object Creator allows uploads without read.
- Editor on the project, with a bucket naming policy :: This is broad, with access across services.
- Storage Object Viewer on the project :: This allows reading every bucket and doesn't allow writing.
> Scope Cloud Storage roles at the bucket level when possible (Object Creator, Object Viewer, Object User, Admin).

### ace-4018 [4.1] d2 #deny-policy #principal-sets
Your organization wants to make sure that no one except a specific break-glass group can delete projects anywhere in the organization, no matter which roles they hold. What should you use?
- A custom role without resourcemanager.projects.delete for everyone :: Users could still receive Owner or other roles that include the permission.
+ An organization deny policy on project deletion, excepting the break-glass group :: Deny policies override allow grants, and exception principals let a designated group keep the ability.
- Remove the Owner role from all projects :: This doesn't cover other roles with the permission, and it's disruptive.
- Place a lien on every project in the organization :: Liens protect individual projects, so you'd have to add them everywhere. Deny policies are the organization-wide control. Liens are still a good extra safeguard.
> Deny policies with exception principals block dangerous permissions organization-wide, and liens protect specific projects.

### ace-4019 [4.1] d2 #iam #gke-rbac
Developers have the Kubernetes Engine Developer IAM role on the project, but the security team wants them to be able to edit Deployments only in the "team-a" namespace of a GKE cluster. What should you do?
- Grant Kubernetes Engine Admin on the project with a team-a condition :: This is too broad.
+ A Kubernetes RBAC Role and RoleBinding in team-a for the developers' group :: IAM controls cluster-level access, and Kubernetes RBAC can grant fine-grained, namespace-scoped permissions.
- Create a separate project per namespace :: This is heavy restructuring for a namespace-level permission.
- Use firewall rules on the nodes to restrict access by namespace :: Firewalls don't control Kubernetes API authorization.
> Combine GKE IAM (project or cluster level) with Kubernetes RBAC (namespace level) for fine-grained access.

### ace-4020 [4.1] d2 #iam #conditions #resource
A group should administer only the Cloud Storage buckets whose names start with "team-blue-" in a shared project. What should you use?
+ Storage Admin with an IAM condition on the bucket name prefix :: Resource-based conditions limit a binding to resources that match a name prefix.
- A custom role named team-blue-storage-admin :: The role name doesn't scope which resources it applies to.
- Labels on the buckets plus a basic Editor role :: You can't use labels in IAM conditions, and Editor is too broad.
- A VPC Service Controls perimeter around the team-blue buckets :: VPC Service Controls limit API access by perimeter, not by bucket name for admin actions.
> IAM Conditions can scope by resource name, type, tags, and request time.

### ace-4021 [4.1] d1 #roles #compute
A team needs to create, start, stop, and delete VMs in a project, but not manage networks or firewall rules. Which predefined role is most appropriate?
- Compute Admin :: Compute Admin includes networking and firewall permissions.
+ Compute Instance Admin (v1) :: Instance Admin manages VMs and disks without network admin rights. If the VMs run as a service account, the team also needs Service Account User on it.
- Compute Network Admin :: This is the opposite of the requirement.
- Editor on the project :: This is far broader than needed.
> Compute Admin covers everything in Compute. Instance Admin covers VMs. Network Admin covers networking. Security Admin covers firewalls and SSL.

### ace-4022 [4.1] d3 #iam #org-policy-vs-iam
Your team is debating whether to use IAM or organization policies to stop people from creating public Cloud Storage buckets. Which statement is correct?
- IAM is the only way, by removing setIamPolicy from everyone :: That would block all IAM management on buckets.
+ Organization policies limit allowed configurations, and IAM limits who can act :: Org policies are the right preventive control for configuration guardrails like public access.
- Organization policies apply only to Compute Engine :: They cover many services, including Cloud Storage, IAM, and GKE.
- You can't prevent public buckets, only detect them with audit logs :: Public access prevention exists for this purpose.
> IAM controls who can act. Organization policies control what configurations are allowed.

### ace-4023 [4.1] d2 #workforce #iam-principals
You configured Workforce Identity Federation with a workforce pool "corp-pool". How do you grant all federated users whose IdP group attribute is "cloud-admins" a role on a project?
- Use --member=group:cloud-admins@corp-pool :: Federated identities don't use the group: prefix.
+ Use a principalSet:// identifier for the pool's cloud-admins group :: Workforce identities are referenced with principal:// and principalSet:// identifiers based on mapped attributes.
- Create a Cloud Identity group and add the federated users manually :: The point of workforce federation is to avoid syncing users.
- Grant the role to allUsers with a condition :: This is unsafe and isn't the correct mechanism.
> Federated principals use principal:// for a single subject and principalSet:// for groups or attributes.

### ace-4024 [4.1] d2 #iam #separation
Developers must be able to deploy Cloud Run services, but only a separate security team may change who can invoke them (the run.invoker bindings). Which role assignment supports this?
+ Developers get Cloud Run Developer, and the security team gets Cloud Run Admin :: Cloud Run Developer excludes IAM policy changes. Admin includes them.
- Give developers Cloud Run Admin and audit their IAM changes :: Admin lets them change invoker bindings themselves.
- Give developers Editor and the security team Owner :: Editor is broad and includes many unrelated permissions.
- Give the security team Cloud Run Invoker on every service :: Invoker calls services. It doesn't manage IAM.
> Separate duties with Developer roles (no setIamPolicy) and Admin roles (with setIamPolicy).

### ace-4101 [4.2] d1 #service-accounts #create
Your application on Compute Engine needs to write to a Pub/Sub topic. Following best practices, what should you do?
- Use the Compute Engine default service account, which has Editor :: The default service account is often overprivileged, and it's shared by many VMs.
+ Attach a dedicated service account with Pub/Sub Publisher on the topic :: A dedicated service account with minimal roles limits the impact if it's compromised.
- Create a service account key and embed it in the application :: Keys are long-lived secrets. Attaching the service account gives automatic short-lived credentials instead.
- Use a developer's personal credentials on the VM :: Never use user credentials for workloads.
> One workload, one service account, least privilege, attached to the resource, with no keys.

### ace-4102 [4.2] d1 #service-accounts #create
Which command creates a service account named report-gen in the current project?
+ gcloud iam service-accounts create report-gen :: This creates report-gen@PROJECT_ID.iam.gserviceaccount.com.
- gcloud projects add-iam-policy-binding --create-sa report-gen :: That command grants roles. It doesn't create service accounts.
- gcloud auth activate-service-account report-gen :: This activates existing credentials from a key file and doesn't create anything.
- gcloud iam roles create report-gen :: That creates a custom role.
> Service account email: NAME@PROJECT_ID.iam.gserviceaccount.com.

### ace-4103 [4.2] d2 #service-agents
After enabling a Google Cloud service, you notice a new account like service-123456789@gcp-sa-pubsub.iam.gserviceaccount.com in your project's IAM page. What is it?
- A user account created by a teammate :: That isn't a user email pattern.
+ A Google-managed service agent for Pub/Sub :: Service agents are created and managed by Google. You may need to grant them roles (for example, for CMEK).
- A deprecated account you should delete :: Removing service agent roles can break the service.
- An external account added by an attacker :: The gcp-sa-* domain is Google-managed.
> Service agents (service-PROJECT_NUMBER@gcp-sa-*.iam.gserviceaccount.com) are Google-managed identities for services.

### ace-4104 [4.2] d2 #default-sa
Your organization was created recently, and you notice that the Compute Engine default service account wasn't automatically granted Editor. Why?
- The Compute Engine API was enabled before the organization existed :: The account exists once the API is enabled. This is about the automatic grant.
+ An organization policy that blocks automatic grants to default service accounts is enforced :: This secure-by-default constraint prevents overprivileged default service accounts.
- Default service accounts have never received any roles automatically :: Historically, they received Editor automatically.
- Editor is granted to it only after the first VM in the project is created :: The automatic grant used to happen at service account creation, when enabled.
> Newer organizations enforce "Disable automatic IAM grants for default service accounts".

### ace-4105 [4.2] d2 #sa-user
A developer has Compute Instance Admin on a project. When they try to create a VM that runs as sa-app@PROJECT.iam.gserviceaccount.com, they get a permission error. What do they need?
- Owner on the project :: This is excessive.
+ Service Account User on sa-app :: Attaching a service account to a resource requires iam.serviceAccounts.actAs on that service account.
- Service Account Key Admin :: Key management isn't needed and shouldn't be.
- Security Reviewer on sa-app :: This is read-only IAM review.
> Deploying a resource that runs as a service account requires Service Account User (actAs) on that service account.

### ace-4106 [4.2] d2 #sa-as-resource
The team wants only the CI/CD group to be able to impersonate the deploy-sa service account, and nobody else in the project. Where should you grant the role?
+ Grant Token Creator to the group on the deploy-sa service account itself :: Service accounts are also resources. Granting on the service account limits who can use that specific account.
- Grant it on the project to the CI/CD group :: Project-level grants allow using or impersonating every service account in the project.
- Grant Token Creator to the CI/CD group at the organization level :: This is far too broad.
- Add the CI/CD group as a member of the service account :: Service accounts don't have group membership. Access is controlled by IAM on the service account.
> A service account is both an identity (roles granted to it) and a resource (who can use or impersonate it).

### ace-4107 [4.2] d2 #impersonation
You want to test, from your laptop, whether the deploy-sa service account has enough permissions to deploy a Cloud Run service, without downloading any keys. What should you do?
- Create a JSON key for deploy-sa and activate it :: This creates a long-lived secret, which is unnecessary.
+ Use --impersonate-service-account with Token Creator on deploy-sa :: Impersonation issues short-lived tokens for the service account, using your own credentials and permission.
- Sign in to the console as deploy-sa with its key :: Service accounts can't sign in to the console with a password.
- Temporarily give yourself all of deploy-sa's roles :: That tests your account, not deploy-sa, and adds privilege.
> Impersonation needs roles/iam.serviceAccountTokenCreator. Use --impersonate-service-account or auth/impersonate_service_account.

### ace-4108 [4.2] d3 #short-lived
An external tool needs a credential for a service account that is valid for only 15 minutes, with no long-lived key. What should you do?
- Create a key and delete it after 15 minutes :: There's still risk while the key exists, and it adds key management.
+ Call generateAccessToken with a 900-second lifetime :: Short-lived OAuth access tokens (and ID tokens or signed JWTs) can be minted on demand, with lifetimes up to 1 hour by default.
- Set the service account's password to expire in 15 minutes :: Service accounts don't have passwords.
- Use a signed URL that expires in 15 minutes :: Signed URLs grant access to Cloud Storage objects only.
> Short-lived credentials come from generateAccessToken, generateIdToken, or signJwt. The default maximum is 1 hour, and an org policy can extend it to 12.

### ace-4109 [4.2] d2 #keys
Your security team discovered dozens of user-managed service account keys, some of them years old. Which actions reduce this risk? (Choose two.)
+ Enforce the organization policy constraints/iam.disableServiceAccountKeyCreation, and replace key use with attached service accounts, impersonation, or Workload Identity Federation :: This prevents new keys and moves workloads to keyless authentication.
+ Find unused keys (for example, with key usage insights or Activity Analyzer), then disable and delete them :: Removing stale keys reduces the attack surface.
- Upload keys to a public Git repository for backup :: That leaks credentials.
- Extend key validity to 10 years so they don't break :: Longer-lived keys increase risk.
- Grant Owner to each service account so they don't fail :: Overprivilege increases the damage if a key leaks.
> Avoid keys. Block creation with org policy, remove unused keys, and use keyless alternatives.

### ace-4110 [4.2] d2 #change-sa
You need to change the service account attached to a running Compute Engine VM. What must you do?
- Change it while the VM is running with gcloud compute instances set-service-account :: The VM must be stopped first.
+ Stop the VM, run set-service-account, then start it again :: Changing a VM's service account or scopes requires the instance to be stopped.
- Recreate the VM. The service account can never be changed :: You can change it while the VM is stopped.
- Edit the instance metadata service-account key :: The service account isn't set through metadata.
> Changing a VM's service account means stop, set-service-account, start. Use cloud-platform scope and control access with IAM.

### ace-4111 [4.2] d2 #scopes
A VM runs as a service account with Storage Admin, but the application gets 403 errors when writing to Cloud Storage. The VM was created with default access scopes. What's the likely issue?
- The bucket is in a different region from the VM :: Region doesn't cause 403 errors like this.
+ The VM's default access scopes allow only read access to Storage :: Legacy access scopes can restrict API access. Best practice is to use the cloud-platform scope and control access with IAM.
- Storage Admin doesn't include permission to write objects :: Storage Admin includes full object control.
- Cloud NAT is missing from the VM's subnet :: Google API access doesn't depend on Cloud NAT in this scenario.
> A VM's API access is the intersection of its scopes and the service account's IAM roles. Use cloud-platform plus IAM.

### ace-4112 [4.2] d3 #gke #workload-identity
Pods in GKE need to read from a Cloud Storage bucket using a Google identity. The security team forbids service account keys and doesn't want all Pods on a node to share the node's service account. What should you do?
- Store a service account key in a Kubernetes Secret :: Keys are forbidden.
- Grant Storage Object Viewer to the node pool's service account :: Every Pod on those nodes would get access.
+ Enable Workload Identity Federation for GKE and grant the role to the KSA :: Each KSA gets its own federated identity, which gives per-workload, keyless access.
- Use the Compute Engine default service account :: This is shared and often overprivileged.
> Workload Identity Federation for GKE gives per-Pod identity (KSA principal or KSA linked to a Google service account) with no keys.

### ace-4113 [4.2] d3 #gke #workload-identity #binding
You're linking the Kubernetes service account "app-ksa" in namespace "prod" to the IAM service account app-gsa@my-proj.iam.gserviceaccount.com with Workload Identity Federation for GKE. Which two steps are required? (Choose two.)
+ Grant roles/iam.workloadIdentityUser on app-gsa to member serviceAccount:my-proj.svc.id.goog[prod/app-ksa] :: This allows the KSA to impersonate the IAM service account.
+ Annotate the KSA with iam.gke.io/gcp-service-account=app-gsa@my-proj.iam.gserviceaccount.com :: The annotation tells GKE which IAM service account the KSA maps to.
- Create a JSON key for app-gsa and mount it :: Keys aren't used with Workload Identity Federation.
- Grant app-gsa the Kubernetes Engine Admin role :: That isn't needed for the mapping, and it's overprivileged.
- Disable the GKE metadata server :: The GKE metadata server is required for Workload Identity Federation.
> KSA-to-GSA linking needs the workloadIdentityUser binding plus the KSA annotation. Alternatively, grant roles directly to the KSA principal.

### ace-4114 [4.2] d3 #wif #github
Your GitHub Actions pipeline deploys to Google Cloud using a service account key stored as a GitHub secret. Security wants to remove the key. What should you configure?
- Store the key in Secret Manager instead :: It's still a long-lived key.
+ Workload Identity Federation with a GitHub OIDC provider :: GitHub's OIDC tokens are exchanged for short-lived Google credentials, so no key is needed.
- Workforce Identity Federation with GitHub as the IdP :: That's for human users, not CI workloads.
- Use OS Login for the GitHub runner :: OS Login is for SSH to VMs.
> CI or external workloads (GitHub, AWS, Azure, on-premises) use Workload Identity Federation (pool, provider, attribute condition), with no keys.

### ace-4115 [4.2] d3 #wif #aws
An application running on AWS EC2 needs to read from a BigQuery dataset. You want to avoid service account keys. What should you do?
+ A workload identity pool with an AWS provider, granted the BigQuery role :: Workload Identity Federation trusts AWS credentials and exchanges them for short-lived Google tokens.
- Create a Cloud Identity user for the EC2 instance :: Users are for people, and this would still need a credential.
- Use Workforce Identity Federation with AWS IAM Identity Center :: Workforce federation is for human users.
- Copy a service account key file to the EC2 instance :: Keys are what you're trying to avoid.
> Multicloud workloads use Workload Identity Federation with AWS or Azure providers.

### ace-4116 [4.2] d2 #cross-project
A service account in project A needs to read objects from a bucket in project B. What should you do?
- Move the bucket and its objects to project A :: This is unnecessary migration.
+ Grant the project A service account Storage Object Viewer on the bucket :: Service accounts are identities and can be granted roles on resources in any project.
- Create a duplicate service account in project B with the same name :: That would be a different identity.
- Use VPC Network Peering between the projects :: IAM, not networking, controls access to Google APIs.
> Service accounts can access resources in other projects. Grant them roles where the resource lives.

### ace-4117 [4.2] d3 #cross-project #attach
You want to attach a service account from project "identities" to VMs in project "workloads", but the operation fails even though the deployer has Service Account User on that service account. What's a likely cause?
- Service accounts can never be attached to resources in other projects :: Cross-project attachment is possible when allowed by policy.
+ iam.disableCrossProjectServiceAccountUsage is enforced on the identities project :: This boolean constraint controls whether service accounts can be attached to resources in other projects.
- The VMs need external IPs to reach the identities project :: That's unrelated to service account attachment.
- The service account needs Compute Admin in project identities :: Roles in the identities project don't affect attachment in workloads.
> Cross-project service account attachment is governed by iam.disableCrossProjectServiceAccountUsage and needs actAs.

### ace-4118 [4.2] d2 #disable-delete
A service account that's used by an unknown legacy system may be compromised. You want to cut off its access immediately, but be able to quickly restore it if something critical breaks. What should you do?
- Delete the service account immediately :: Recovery is possible for a limited time, but disabling is the cleaner reversible step.
+ Disable the service account and watch for breakage :: Disabling blocks authentication immediately and is fully reversible with enable.
- Rename the service account's ID :: Service account IDs can't be renamed, and renaming the display name doesn't change access.
- Remove its display name and description :: This has no effect on access.
> Disable is instant and reversible. Delete can be undone within about 30 days, but recreating the same email gives a new identity.

### ace-4119 [4.2] d3 #recreate-sa
You deleted a service account and created a new one with the same name a week later, but the new one doesn't have the roles the old one had. Why?
+ The new account has a different unique ID, so old bindings don't apply :: Bindings reference the old identity, and reusing the email doesn't restore access.
- Roles take up to 7 days to propagate to a new account :: IAM changes propagate in minutes, not days.
- Service account names can't be reused :: Names can be reused after deletion, but the new account is a different identity.
- The project quota for service accounts was exceeded :: A quota issue would fail creation, not remove roles.
> Recreated service accounts are new identities. Re-grant roles, or undelete the original within the window.

### ace-4120 [4.2] d2 #cloud-run #identity
By default, a Cloud Run service runs as the Compute Engine default service account. Your security team wants each service to have its own minimal identity. What should you do?
+ Deploy each service with its own service account holding only the roles it needs :: Per-service identities enforce least privilege and isolate the impact of a compromise.
- Grant the default service account Owner so nothing fails :: This is the opposite of least privilege.
- Embed a key file in the container image :: Keys in images get leaked, and the runtime provides credentials automatically.
- Use the same service account for all services in the organization :: Shared identities widen the impact if one is compromised.
> Give every Cloud Run, Cloud Run functions, or GKE workload a dedicated service account.

### ace-4121 [4.2] d2 #token-lifetime
A workload needs access tokens valid for up to 8 hours for a long-running process that can't refresh tokens. What must be configured?
- Nothing. Tokens are valid for 24 hours by default :: The default maximum lifetime is 1 hour.
+ List the account in the credential lifetime extension constraint, then request 8-hour tokens :: Extending beyond 1 hour requires listing the service account in this constraint.
- Create a service account key with an 8-hour expiry and use it directly :: Keys aren't access tokens. Short-lived token lifetimes are set when the token is generated.
- Request a refresh token for the service account and renew every hour :: Service accounts don't use refresh tokens the way users do.
> Token lifetime is 1 hour by default and up to 12 hours with the allowServiceAccountCredentialLifetimeExtension constraint.

### ace-4122 [4.2] d3 #multiple #service-accounts
Which two statements about service accounts are correct? (Choose two.)
+ A service account can be granted roles on resources (as an identity) and can have IAM policies of its own controlling who can use or impersonate it (as a resource) :: This dual nature is key to managing service account security.
- Service accounts can sign in to the Google Cloud console with a password :: Service accounts have no passwords and don't use interactive console sign-in.
+ Attaching a user-managed service account to a VM lets applications on it get short-lived credentials from the metadata server without keys :: The metadata server provides automatically rotated tokens for the attached service account.
- Google-managed service agents should be deleted to improve security :: Deleting or stripping service agents breaks the services that rely on them.
- Service account keys expire automatically after 90 days by default :: User-managed keys don't expire by default unless an expiry policy is configured.
> Service accounts are identities and resources. Prefer attached accounts or impersonation over keys, and leave service agents alone.

### ace-4123 [4.2] d2 #scheduler #oidc
A Cloud Scheduler job must call a private Cloud Run service (one that requires authentication) every hour. How should you configure it?
- Make the Cloud Run service public and check a header in the code :: This removes the protection unnecessarily.
+ Use an OIDC token from a service account with Cloud Run Invoker :: Scheduler can attach an ID token for a service account, and Cloud Run checks that the account has run.invoker.
- Add an API key to the request header :: Cloud Run authentication uses IAM and ID tokens, not API keys.
- Use the Cloud Scheduler service agent with Owner :: This is overprivileged, and the agent isn't the intended invoker identity.
> For service-to-service calls to private Cloud Run, use an OIDC ID token from a service account with roles/run.invoker.

### ace-4124 [4.2] d2 #secret-manager
An application on Cloud Run needs a third-party API key. Developers currently put it in an environment variable in the deployment script, which is committed to Git. What should you do?
+ Store it in Secret Manager and give the service account access to that secret :: Secret Manager stores and versions secrets with IAM-controlled access, and Cloud Run can mount secrets or expose them as environment variables.
- Base64-encode the key in the deployment script :: Base64 isn't encryption.
- Put the key in a Cloud Storage bucket and read it at container startup :: That exposes the secret.
- Hardcode the key in the container image and keep the image private :: Images get shared and cached, so this leaks secrets.
> Store secrets in Secret Manager and give the workload's service account secretAccessor on just that secret.
