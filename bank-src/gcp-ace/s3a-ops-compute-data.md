// Section 3: Ensuring successful operation of a cloud solution (~30%)
// 3.1 managing compute resources, 3.2 managing storage and data

### ace-3001 [3.1] d2 #iap #ssh
You need SSH access to a Linux VM that has no external IP address, and you don't want a bastion host. What should you do?
- Assign a temporary external IP and remove it afterward :: This exposes the VM and is easy to forget to remove.
+ Use gcloud compute ssh --tunnel-through-iap, with a firewall rule for IAP's range :: IAP lets you reach VMs without external IPs. You need a firewall rule for the IAP range and the iap.tunnelResourceAccessor role.
- Configure Cloud NAT so inbound SSH reaches the VM's internal IP :: Cloud NAT only provides outbound connections from VMs. It doesn't allow inbound SSH.
- Enable VPC Flow Logs on the subnet and open a session from the logs view :: Flow logs record traffic metadata. They don't create connections.
> IAP TCP forwarding gives SSH or RDP to internal-only VMs. Allow 35.235.240.0/20 and grant roles/iap.tunnelResourceAccessor.

### ace-3002 [3.1] d2 #serial-console
A VM fails to boot after a bad /etc/fstab change, and SSH doesn't work. You want to see boot messages and fix it interactively. What should you use?
+ Connect to the VM's interactive serial console :: The serial console works even when networking or SSH is broken, so you can troubleshoot boot problems.
- Restart the VM repeatedly until SSH works :: The same fstab error will recur on every boot.
- Delete the VM and recreate it from the original image :: Data and configuration on the boot disk would be lost unnecessarily.
- Open the VM's CPU and disk metrics in Cloud Monitoring :: Metrics don't show boot console errors.
> For boot or SSH failures, use the serial port output and the interactive serial console, or attach the disk to a rescue VM.

### ace-3003 [3.1] d1 #instances-list
You want to list only running VMs in zone us-central1-a that have the label env=prod. Which command should you use?
- gcloud compute instances describe --zone=us-central1-a --labels=env=prod :: describe shows a single instance.
+ gcloud compute instances list --filter="zone:us-central1-a AND status=RUNNING AND labels.env=prod" :: --filter narrows the list by zone, status, and labels.
- gcloud compute zones list --filter="name:us-central1-a AND labels.env=prod AND status=UP" :: That lists zones, not VMs.
- kubectl get nodes -l env=prod --all-namespaces :: That lists GKE nodes, not all Compute Engine VMs.
> gcloud ... list --filter= plus --format= is the standard way to query resources.

### ace-3004 [3.1] d2 #snapshots #schedule
You need automatic daily backups of a VM's persistent disk, kept for 14 days, with no custom scripts. What should you do?
- Write a cron job on the VM that calls gcloud compute disks snapshot :: This works, but it's custom code that fails if the VM is down.
+ Attach a daily snapshot schedule with 14-day retention to the disk :: Snapshot schedules automate creation and deletion of snapshots.
- Create a machine image of the VM manually every day :: This is manual and doesn't meet the automation requirement.
- Enable Object Versioning on the disk with a 14-day limit :: Versioning is a Cloud Storage feature, not a disk feature.
> Snapshot schedules are resource policies attached to disks, with frequency and retention.

### ace-3005 [3.1] d2 #snapshots
Daily snapshots of a 500 GB disk have been taken for 30 days. You want to delete the snapshot from day 10. What happens to the later snapshots?
- They become corrupted, because snapshots depend on each other :: Google Cloud handles dependencies when you delete a snapshot.
+ They remain usable, because needed data is kept for them :: Snapshots are incremental, but deleting one is safe because the required blocks are retained.
- You must delete all later snapshots first :: Snapshots can be deleted in any order.
- Day 10 can't be deleted until day 11 is converted to a full snapshot :: No manual conversion is needed.
> Snapshots are incremental and safe to delete in any order.

### ace-3006 [3.1] d2 #images #image-family
Your team builds a hardened Ubuntu image every month. You want instance templates to always use the latest hardened image without editing them each month. What should you do?
+ Put each monthly image in an image family and reference the family :: An image family resolves to its latest non-deprecated image.
- Delete last month's image and reuse the same image name :: You can't overwrite an image name in place, and this loses rollback ability.
- Use a monthly snapshot of the hardened VM instead of an image :: Snapshots back up disks. Images are the right tool for repeatable VM creation.
- Store the image in a Cloud Storage bucket and download it at boot :: That isn't how Compute Engine boot images work.
> Image families point to the latest image, and you can deprecate a bad image to roll back.

### ace-3007 [3.1] d2 #machine-image
You need to clone an entire multi-disk VM, including all attached disks, metadata, and machine configuration, into another project for testing. What's the most direct way?
- Snapshot the boot disk and copy the metadata by hand :: You'd miss data disks and VM configuration.
+ Create a machine image and create the new VM from it :: Machine images capture all disks, configuration, metadata, and permissions of a VM.
- Export the VM configuration to CSV with gcloud and re-import it :: There's no such export.
- Create a custom image from each disk and recreate metadata manually :: This works but is more manual and error-prone.
> Snapshot is one disk. Image is for booting new VMs. Machine image is a whole VM, with every disk and its config.

### ace-3008 [3.1] d1 #gke #inventory
After connecting to a GKE cluster, you want to see the nodes, all Pods in every namespace, and the Services. Which commands should you use?
- gcloud container clusters list, gcloud container pods list, gcloud container services list :: gcloud lists clusters and node pools, not Pods or Services.
+ kubectl get nodes, kubectl get pods --all-namespaces (or -A), kubectl get services :: kubectl reads Kubernetes objects from the cluster API.
- gcloud compute instances list only :: That shows the underlying VMs for Standard clusters, not Pods or Services.
- kubectl describe cluster :: There's no such resource. Use kubectl cluster-info for cluster endpoints.
> Use gcloud for cluster and node-pool infrastructure, and kubectl for workloads (Pods, Services, Deployments).

### ace-3009 [3.1] d2 #artifact-registry #gke
Pods in your GKE cluster fail with ImagePullBackOff when pulling from us-central1-docker.pkg.dev/other-project/apps/web:1.2, a repository in a different project. What's the most likely fix?
- Make the repository public and pull it anonymously :: This exposes your images and is unnecessary.
+ Grant Artifact Registry Reader on the repository to the nodes' service account :: Nodes pull images with the node service account, which needs read access to cross-project repositories.
- Switch the image path to gcr.io/other-project/apps/web:1.2 :: Container Registry is deprecated, and switching hosts doesn't fix permissions.
- Increase the node pool size so pulls are spread across more nodes :: Pull errors aren't caused by too few nodes.
> Image pulls use the node service account, so grant artifactregistry.reader on the repository.

### ace-3010 [3.1] d2 #node-pools #autoscaling
A GKE Standard cluster's default node pool sometimes runs out of capacity during peaks, and Pods stay Pending. You want nodes added automatically between 3 and 10. What should you run?
+ gcloud container clusters update CLUSTER --node-pool=default-pool --enable-autoscaling --min-nodes=3 --max-nodes=10 :: This enables the cluster autoscaler on the node pool, which adds nodes when Pods can't be scheduled.
- kubectl autoscale deployment web --min=3 --max=10 :: That scales Pods (HPA), not nodes.
- gcloud compute instance-groups managed set-autoscaling NODE_POOL_MIG --min-num-replicas=3 --max-num-replicas=10 :: Node pool MIGs are managed by GKE. Use GKE's autoscaler instead.
- kubectl scale nodes --replicas=10 --min=3 --max=10 :: That isn't a valid command.
> Pending Pods from lack of capacity call for the cluster autoscaler (node pool). CPU-based Pod scaling calls for HPA.

### ace-3011 [3.1] d2 #node-pools #migration
Your workloads run on a node pool of e2-standard-4 nodes. You need to move them to n2-highmem-8 nodes with minimal disruption and the ability to roll back. What's a common approach?
- SSH into each node and change its machine type :: You can't change node VMs individually. GKE manages them.
+ Add an n2-highmem-8 pool, cordon and drain the old pool, then delete it :: A parallel node pool with cordon and drain gives a controlled migration, and the old pool stays available until you delete it.
- Delete the old node pool first, then create the new one :: All Pods would be evicted with nowhere to run.
- Change the Deployment's image tag to an n2-highmem-8 build :: The image tag doesn't affect node machine types.
> To change node shapes safely, add a new pool, cordon and drain the old one, then delete it.

### ace-3012 [3.1] d2 #statefulset
You're deploying a three-replica database on GKE. Each replica needs a stable network identity (db-0, db-1, db-2) and its own persistent volume that follows it when rescheduled. Which Kubernetes resource should you use?
- Deployment with 3 replicas :: Deployment Pods are interchangeable, with random names and shared volume templates.
+ StatefulSet :: StatefulSets give ordered, stable Pod names and a PersistentVolumeClaim per replica.
- DaemonSet :: DaemonSets run one Pod per node, which is for agents.
- Job with parallelism 3 :: Jobs run to completion.
> Use StatefulSet for stable identity and per-Pod storage, Deployment for stateless apps, DaemonSet for one Pod per node, and Job or CronJob for batch.

### ace-3013 [3.1] d2 #hpa
A Deployment named web should scale between 2 and 15 replicas to keep average CPU utilization around 60%. What should you do?
+ kubectl autoscale deployment web --cpu-percent=60 --min=2 --max=15 :: The HPA adjusts the replica count based on observed CPU against the Pods' CPU requests.
- Enable the cluster autoscaler with min 2 and max 15 nodes :: The cluster autoscaler adds nodes but doesn't change replica counts.
- Set replicas: 15 in the Deployment and a CPU limit of 60% :: A fixed count isn't autoscaling.
- Use the Vertical Pod Autoscaler in Auto mode on CPU :: VPA changes per-Pod requests, not replica counts.
> HPA scales the number of Pods, VPA sizes each Pod's requests, and the cluster autoscaler adds or removes nodes.

### ace-3014 [3.1] d3 #vpa
You don't know the right CPU and memory requests for several Deployments, and some Pods are OOMKilled while others are overprovisioned. You want Kubernetes to recommend, and optionally apply, better requests. What should you use?
- Horizontal Pod Autoscaler on memory :: Adding replicas doesn't fix requests that are wrong for each Pod.
+ Vertical Pod Autoscaler, starting in recommendation mode :: VPA analyzes usage and recommends or sets CPU and memory requests per container.
- Increase the node machine size in every pool :: Larger nodes don't fix wrong Pod requests.
- Remove memory limits so Pods can't be OOMKilled :: That isn't valid, and it doesn't solve sizing.
> Use VPA to right-size requests. Avoid combining VPA and HPA on the same CPU or memory metric.

### ace-3015 [3.1] d2 #autopilot #requests
In GKE Autopilot, a team deploys Pods without specifying CPU or memory requests and is surprised by the resources allocated and billed. What should they understand?
- Autopilot bills per node, so Pod requests don't affect the cost :: Autopilot generally bills on Pod resource requests, not nodes.
+ Autopilot applies default requests and bills on requests, so set them explicitly :: Explicit requests make sure Pods get the right size and the right cost.
- Pods without requests run for free, using spare node capacity :: Pods without requests still get default requests applied.
- Autopilot ignores requests and bills on actual usage :: Requests drive scheduling and billing.
> In Autopilot, always set resource requests, because they determine scheduling and cost.

### ace-3016 [3.1] d2 #cloud-run #revisions
You want to deploy a new version of a Cloud Run service and test it at a special URL before it receives any production traffic. What should you do?
- Deploy normally. Cloud Run sends 0% to new revisions by default :: By default, a new deployment receives 100% of traffic.
+ gcloud run deploy with --no-traffic --tag=candidate :: --no-traffic keeps production traffic on the current revision, and --tag gives the new revision its own URL.
- Create a second project and deploy the new version there :: This works but adds unnecessary overhead.
- Delete the current revision, then deploy the new one :: That would cause downtime.
> Cloud Run: --no-traffic plus --tag lets you test a revision, then update-traffic to roll it out.

### ace-3017 [3.1] d2 #cloud-run #traffic-split
Your new Cloud Run revision passed testing. You want 10% of production traffic on it and 90% on the current revision, so you can watch error rates. Which command should you run?
+ gcloud run services update-traffic SERVICE --to-revisions=NEW_REVISION=10 :: update-traffic sets percentage splits between revisions or tags. Rollback is just another update-traffic call.
- gcloud run deploy SERVICE --traffic=10 :: deploy has no --traffic flag for splitting.
- Create a load balancer with two serverless NEG backends weighted 90/10 :: This is unnecessary, since Cloud Run supports traffic splitting natively.
- kubectl set traffic service/SERVICE new-revision=10 :: This isn't a Cloud Run or kubectl command.
> Cloud Run canary: update-traffic --to-revisions=REV=PERCENT or --to-latest.

### ace-3018 [3.1] d2 #cloud-run #concurrency
A Cloud Run service is CPU-bound, and each request uses a full vCPU. Under load, latency spikes because many requests share one instance. What should you tune?
- Increase the maximum request timeout :: Requests would wait longer, but contention wouldn't change.
+ Lower the per-instance concurrency so Cloud Run scales out :: Concurrency controls how many requests one instance handles. Lowering it suits CPU-heavy requests.
- Enable session affinity so requests stick to warm instances :: Affinity doesn't reduce CPU contention.
- Set minimum instances to 0 so instances restart fresh :: That increases cold starts and doesn't address contention.
> Cloud Run concurrency defaults to 80. Lower it for CPU-bound requests and raise it for I/O-bound requests.

### ace-3019 [3.1] d3 #gke #traffic-split
On GKE, you want to send 20% of HTTP traffic to version v2 of a service and 80% to v1, at the load-balancer level. What's the Kubernetes-native way to do this?
- Run two Deployments with replica counts of 8 and 2 behind one Service :: Replica ratios give only approximate splits and couple capacity to traffic share.
+ Use the Gateway API with an HTTPRoute that has two backendRefs, weighted 80 and 20 :: GKE Gateway controllers support weighted traffic splitting between backend Services.
- Use a ConfigMap with a traffic percentage :: ConfigMaps don't route traffic.
- Create two clusters and use DNS round robin :: This is crude, and DNS caching makes it unpredictable.
> GKE traffic splitting uses Gateway API HTTPRoute weights. On Cloud Run and Cloud Run functions, use revision traffic splits.

### ace-3020 [3.1] d3 #gpu #attach
An existing Compute Engine VM running a general-purpose machine type now needs an NVIDIA L4 GPU for inference. What must you do?
- Attach the GPU while the VM is running, through hot-plug :: GPUs can't be hot-added to running VMs.
+ Stop the VM, switch to a G2 machine type, set maintenance to TERMINATE, and install drivers :: GPU changes require a stopped VM. On accelerator-optimized series, the GPU is defined by the machine type, and drivers must be installed.
- Add the GPU to the instance template and let the VM pick it up on reboot :: Templates affect new VMs, not this existing VM.
- Enable the GPU API in the project, then restart the VM to load the device :: There's no such API toggle. You need to change the machine and GPU configuration.
> GPUs need the VM stopped, a matching machine type or accelerator config, TERMINATE on maintenance, and drivers installed.

### ace-3021 [3.1] d2 #workbench #notebooks
A data scientist wants a managed JupyterLab environment in Google Cloud with GPU options, integrated with BigQuery, without managing VMs themselves. What should you provide?
- A Compute Engine VM with Jupyter installed by hand :: This is possible, but it's unmanaged and needs manual patching and setup.
+ A Workbench instance :: Workbench offers managed JupyterLab instances with GPU options, and BigQuery notebooks give a notebook experience next to the data.
- Cloud Shell with JupyterLab :: Cloud Shell is a terminal with limited resources and no GPUs.
- Cloud Workstations :: Workstations are managed developer IDE environments, not the primary notebook service.
> Workbench gives managed JupyterLab. BigQuery Studio notebooks (Colab Enterprise) put notebooks alongside your data.

### ace-3022 [3.1] d2 #cloud-workstations
Your company wants every developer to have a secure, standardized, browser-accessible development environment that runs inside the company VPC, uses preconfigured IDE images, and can't store source code on laptops. What should you use?
+ Cloud Workstations with a shared configuration :: Cloud Workstations provides managed, customizable developer environments running in your VPC and accessible through a browser or local IDE.
- Cloud Shell for every developer :: Cloud Shell isn't customizable per organization and doesn't run in your VPC.
- A shared Compute Engine VM for all developers :: Shared VMs mean no isolation, and standardization is manual.
- Workbench instances for every developer :: Workbench focuses on data science notebooks, not general IDE environments.
> Cloud Workstations are managed, standardized dev environments inside your VPC.

### ace-3023 [3.1] d2 #agent-runtime #deploy
Your team has tested an ADK agent locally and wants to deploy it to Agent Runtime on Gemini Enterprise Agent Platform. Which of these is a required consideration?
- The agent must first be rewritten as a Cloud Run function :: Agent Runtime deploys agent code directly through the SDK or CLI.
+ The agent's runtime identity needs least-privilege access to the data its tools call :: Deployment uses project IAM, and at runtime the agent acts through a service identity that needs least-privilege access to its tools.
- Agents can only be deployed from Cloud Shell with the ADK preinstalled :: You can deploy from any environment with the SDK and credentials.
- Agent Runtime requires a GKE cluster that you manage :: Agent Runtime is a managed service. You don't manage a cluster.
> Deploying agents works like any workload: correct IAM for deployment and a least-privilege runtime identity.

### ace-3024 [3.1] d3 #mig #autohealing
A MIG's autohealing keeps recreating VMs shortly after they boot, even though the application eventually starts fine after about 3 minutes. What should you change?
- Remove the health check from the group's autohealing policy :: You'd lose autohealing protection.
+ Increase the autohealing initial delay past the startup time :: The initial delay gives new instances time to start before health checks can trigger recreation.
- Switch to an unmanaged instance group :: You'd lose autohealing and autoscaling.
- Use a larger, faster SSD boot disk so the app starts sooner :: Disk size isn't the cause.
> Set the MIG autohealing initial delay to cover the application's warm-up time.

### ace-3101 [3.2] d2 #signed-urls
Customers without Google accounts need to download a private invoice PDF from a Cloud Storage bucket for 15 minutes only. What should you do?
- Make the object public for 15 minutes :: Anyone with the link could access it, and you'd have to remember to revoke it.
+ Generate a signed URL with a 15-minute expiration :: Signed URLs grant time-limited access to a specific object to anyone who has the URL, with no Google account needed.
- Grant allUsers Storage Object Viewer on the bucket :: This makes the whole bucket public.
- Email the file as an attachment from a VM :: This bypasses Cloud Storage and doesn't scale.
> Signed URLs give time-limited object access without IAM identities.

### ace-3102 [3.2] d2 #uniform-access #security
Your security team wants all access to a bucket controlled only by IAM, with object ACLs disabled, and the bucket must never be made public by accident. Which two settings should you enable? (Choose two.)
+ Uniform bucket-level access :: This disables object ACLs so that only IAM controls access.
+ Public access prevention :: This blocks granting access to allUsers and allAuthenticatedUsers.
- Requester Pays :: This changes who pays for access. It isn't access control.
- Object Versioning :: Versioning protects against overwrites, not public exposure.
- Autoclass :: Autoclass handles storage class optimization.
> Uniform bucket-level access plus public access prevention gives IAM-only access that can't become public, and organization policies can enforce both.

### ace-3103 [3.2] d2 #retention #bucket-lock
Regulations require that financial records in a bucket can't be deleted or modified by anyone, including admins, for 7 years. What should you configure?
- Object Versioning with a 7-year noncurrent rule :: Admins could still delete versions.
- IAM deny policies for storage.objects.delete :: A sufficiently privileged admin could change the deny policies.
+ A locked 7-year retention policy on the bucket :: A locked retention policy can't be removed or shortened, and objects can't be deleted until they reach the retention age.
- Soft delete with a 7-year window :: Soft delete has a much shorter maximum window, and it doesn't prevent deletion.
> Locked retention policies (Bucket Lock) give WORM compliance and can't be undone.

### ace-3104 [3.2] d2 #lifecycle
Logs in a bucket should move to Coldline after 30 days and be deleted after 365 days. How should you implement this?
+ Lifecycle rules: SetStorageClass COLDLINE at age 30, Delete at age 365 :: Lifecycle rules apply actions automatically based on conditions such as age.
- Write a daily Cloud Run job that lists and rewrites objects :: This is custom code for a built-in feature.
- Set the bucket's default storage class to Coldline :: New objects would go to Coldline immediately, and nothing would be deleted.
- Enable Autoclass with a 30-day transition and a 365-day deletion :: Autoclass doesn't delete objects.
> Lifecycle rules can change storage class or delete objects based on age, version count, live state, prefix, and other conditions.

### ace-3105 [3.2] d3 #lifecycle #versioning
A bucket has Object Versioning enabled, and storage costs keep growing because of old noncurrent versions. You want to keep only the 3 most recent noncurrent versions of each object. What lifecycle condition should you use?
- Delete when age is 3 :: Age is measured in days and doesn't count versions.
+ Delete when numNewerVersions is 3 :: numNewerVersions deletes a noncurrent version once it has 3 newer versions.
- createdBefore: 3 versions ago :: createdBefore takes a date, not a version count.
- Suspend versioning on the bucket :: This stops new versions but doesn't clean up existing ones, and you lose protection.
> Control versioned buckets with numNewerVersions and daysSinceNoncurrentTime lifecycle conditions.

### ace-3106 [3.2] d1 #bigquery #query
You want to run a standard SQL query against BigQuery from the command line. Which command should you use?
- gcloud sql query --sql='SELECT ...' :: That's for Cloud SQL (and the command doesn't exist in that form).
+ bq query --use_legacy_sql=false 'SELECT ...' :: The bq CLI runs queries, and --use_legacy_sql=false selects GoogleSQL.
- gcloud storage query 'SELECT ...' :: There's no such command.
- cbt query 'SELECT ...' :: cbt is the Bigtable CLI.
> bq query --nouse_legacy_sql for GoogleSQL from the CLI.

### ace-3107 [3.2] d2 #bigquery #cost
Before running a large BigQuery query on on-demand pricing, you want to know how many bytes it will process without running it or incurring cost. What should you do?
+ Run it with the --dry_run flag :: A dry run returns the bytes that would be processed at no charge, so you can estimate cost.
- Run it with LIMIT 10 and multiply the cost :: LIMIT doesn't reduce bytes scanned in most cases.
- Run SELECT COUNT(*) on each table first :: This runs a different query and may still scan data.
- Check Cloud Monitoring CPU metrics :: BigQuery cost is based on bytes processed (on-demand) or slots used, not VM CPU.
> Estimate BigQuery costs with dry runs. Partitioning, clustering, and selecting only the columns you need reduce bytes scanned.

### ace-3108 [3.2] d2 #bigquery #partitioning
Queries on a 10 TB events table almost always filter by event_date, yet every query scans the whole table. How can you reduce cost and improve performance?
- Add LIMIT clauses to every query :: LIMIT doesn't prevent full scans.
+ Partition the table by event_date :: Partitioning lets BigQuery skip irrelevant partitions, which reduces bytes scanned.
- Copy the table to Cloud SQL with an index :: Cloud SQL isn't suited to 10 TB analytics.
- Use SELECT * to warm the cache :: This scans everything and increases cost.
> Partition on the main filter (date) and cluster on secondary filters to prune scans.

### ace-3109 [3.2] d2 #cloud-sql #connect
You need to connect to a Cloud SQL for PostgreSQL instance from your laptop securely, without adding your IP to authorized networks, using IAM-based authorization. What should you use?
- A public IP with authorized network 0.0.0.0/0 :: This is highly insecure.
+ The Cloud SQL Auth Proxy :: The Auth Proxy creates secure, IAM-authorized, encrypted connections without managing IP allowlists or SSL certificates.
- Cloud NAT with a static IP :: NAT handles outbound traffic from VPC resources and isn't a database connection tool.
- VPC Flow Logs to authorize sessions :: These are logs, not a connection method.
> The Cloud SQL Auth Proxy gives IAM-authorized, encrypted connections with no IP allowlisting.

### ace-3110 [3.2] d2 #cloud-sql #pitr
A developer ran a DELETE without a WHERE clause on a Cloud SQL for MySQL production table at 14:05. Automated backups and point-in-time recovery are enabled. What's the best way to recover?
- Restore the last nightly backup over the production instance :: You'd lose all changes since the backup and overwrite current data.
+ Clone the instance with PITR to just before 14:05 and recover the table :: PITR uses binary logs to restore to a specific moment, in a new instance, without touching the original.
- Ask Google Support to undo the DELETE :: Support can't undo application-level SQL.
- Restart the instance to roll back the open transaction :: Restarting doesn't revert committed transactions.
> Cloud SQL PITR clones to a timestamp in a new instance. Enable backups and PITR before you need them.

### ace-3111 [3.2] d2 #backups #firestore #spanner
Which statement about backup and recovery for Google Cloud databases is correct?
- Spanner has no backup capability, so you must export to CSV :: Spanner supports managed backups and point-in-time recovery through version retention.
+ Firestore and Spanner both support backups and point-in-time recovery :: Both offer managed protection against accidental changes.
- Bigtable backups are taken automatically every hour with no configuration :: Bigtable backups are created on demand or on a schedule that you configure.
- AlloyDB can only be backed up by stopping the cluster :: AlloyDB provides continuous backups and on-demand backups without downtime.
> Know each service's backup tools: Cloud SQL (backups and PITR), Spanner (backups and version retention PITR), Firestore (scheduled backups and PITR), Bigtable (backups), and AlloyDB (continuous backups and PITR).

### ace-3112 [3.2] d2 #bigquery #jobs
An overnight BigQuery load job reportedly failed. You want to see the job's status and error details from the CLI. What should you do?
- gcloud logging read "bigquery" only :: Logs can help, but bq gives direct job status and errors.
+ bq ls -j -a, then bq show -j JOB_ID :: bq show -j shows the job's status and errorResult details.
- gcloud dataflow jobs describe JOB_ID :: That's for Dataflow, not BigQuery jobs.
- kubectl logs bigquery-load :: That's for Pods.
> bq ls -j and bq show -j for BigQuery jobs, and gcloud dataflow jobs list/describe for Dataflow.

### ace-3113 [3.2] d2 #dataflow #status
A streaming Dataflow pipeline's latency has grown steadily. Where should you look first to find the bottleneck?
+ The Dataflow job graph, system lag, and worker logs :: The job graph and metrics show which step is slow, and worker logs reveal errors.
- Cloud Billing Reports for Dataflow SKUs :: Billing shows costs, not pipeline bottlenecks.
- Cloud Asset Inventory change history :: Asset Inventory lists resources, not pipeline performance.
- The Cloud SQL Query Insights page for the sink :: That's for Cloud SQL query performance.
> Dataflow monitoring covers the job graph, system lag, data freshness, autoscaling history, and worker logs.

### ace-3114 [3.2] d2 #database-center
Your company runs 120 database instances across Cloud SQL, AlloyDB, and Spanner in many projects. The DBA team wants one dashboard that shows fleet health and issues such as missing backups or outdated versions. What should they use?
- A Cloud Monitoring dashboard per project :: This is fragmented and doesn't surface configuration issues like missing backups.
+ Database Center :: Database Center gives a fleet-wide view of database health, security, and configuration across Google Cloud database services, with AI-assisted insights.
- Cloud Asset Inventory exports to Sheets :: This is manual and has no health analysis.
- Query Insights :: Query Insights analyzes query performance on individual instances.
> Database Center is a fleet-level view of database health and best-practice issues.

### ace-3115 [3.2] d3 #cmek
Your compliance team requires that a Cloud Storage bucket and a BigQuery dataset be encrypted with keys your company controls and can rotate or disable. What should you do?
- Nothing. Google default encryption already satisfies "company-controlled keys" :: Default encryption uses Google-managed keys, not keys you control.
+ Create a Cloud KMS key, grant the service agents access to it, and set it as default CMEK :: CMEK requires the service agent to have access to the key. Disabling the key makes the data inaccessible.
- Encrypt the files locally before upload and store the key in a bucket :: That's client-side encryption with poor key management, and it doesn't work for BigQuery.
- Use customer-supplied encryption keys (CSEK) for BigQuery :: BigQuery doesn't support CSEK. CMEK is the supported option.
> CMEK: a KMS key, the service agent granted cryptoKeyEncrypterDecrypter, and the key set on the resource, in a matching location.

### ace-3116 [3.2] d2 #storage-cost
You need to estimate the monthly cost of storing 40 TB in Coldline and reading 2 TB per month from it. Which cost components should you include? (Choose two.)
+ Storage cost per GB-month for Coldline :: Storage is billed per GB per month by class and location.
+ Data retrieval fees for reading Coldline data (plus any network egress) :: Colder classes charge per GB retrieved, and egress applies outside the location.
- A per-object license fee :: There's no license fee. Operation charges exist, but not per-object licenses.
- VM uptime charges :: Cloud Storage isn't billed by VM uptime.
- Mandatory Cloud CDN charges :: CDN is optional.
> Cloud Storage cost is storage plus operations plus retrieval (for colder classes) plus network egress, plus early-deletion charges if applicable.

### ace-3117 [3.2] d2 #bigtable #query
You need to quickly read a few rows from a Bigtable table by row key prefix from the command line for debugging. What should you use?
- bq query 'SELECT * FROM bigtable.TABLE' :: Bigtable tables can be queried from BigQuery through external tables, but that isn't the quick native CLI way.
+ cbt read TABLE prefix=device123# :: cbt is the Bigtable command-line tool for reading and managing tables.
- gcloud sql connect TABLE :: That's for Cloud SQL.
- gcloud spanner databases execute-sql :: That's for Spanner.
> Bigtable uses cbt (or Bigtable Studio), Spanner uses gcloud spanner databases execute-sql, Cloud SQL uses gcloud sql connect, and BigQuery uses bq query.

### ace-3118 [3.2] d2 #firestore #indexes
A Firestore query that filters on two fields and sorts by a third fails with an error asking you to create an index. What should you do?
+ Create the composite index the error message links to :: Firestore needs composite indexes for queries that combine multiple fields, and the error message links to the exact index definition.
- Switch to Datastore mode to avoid indexes :: Datastore mode also requires composite indexes.
- Export the data to BigQuery for every query :: This is unnecessary for an application query.
- Add more Firestore instances to share the query load :: Capacity isn't the issue.
> Firestore creates single-field indexes automatically, but composite queries need composite indexes.

### ace-3119 [3.2] d2 #soft-delete
An engineer accidentally deleted several objects from a bucket an hour ago. Versioning wasn't enabled, but the bucket uses the default soft delete policy. What can you do?
- Nothing. Without versioning, deletion is permanent :: Soft delete keeps deleted objects for a retention window (7 days by default).
+ Restore the soft-deleted objects with gcloud storage restore :: Soft delete keeps deleted objects recoverable for the configured period.
- Open a support case to recover them from tape :: Google doesn't offer tape restores for customers.
- Recreate them from the Data Access entries in Cloud Logging :: Logs don't contain object contents.
> Soft delete (7 days by default) protects against accidental deletes, even without versioning.
