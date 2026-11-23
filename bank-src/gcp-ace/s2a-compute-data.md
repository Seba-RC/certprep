// Section 2: Planning and implementing a cloud solution (~30%)
// 2.1 compute, 2.2 storage and data

### ace-2001 [2.1] d1 #compute-options #cloud-run
You need to deploy a stateless containerized REST API that has unpredictable traffic, sometimes zero requests for hours. The team doesn't want to manage servers or clusters and wants to pay as little as possible when idle. Which service should you choose?
- Compute Engine managed instance group with autoscaling :: MIGs can autoscale, but they keep at least one VM running and you manage the OS.
- GKE Standard cluster :: You manage node pools and pay for nodes even when idle.
+ Cloud Run :: Cloud Run runs containers serverlessly, scales on requests, and can scale to zero, so you pay nothing for idle time with default settings.
- Compute Engine Spot VM :: Spot VMs are cheap but can be preempted, need management, and don't scale to zero by themselves.
> Stateless HTTP containers with spiky or zero traffic and no ops point to Cloud Run.

### ace-2002 [2.1] d1 #compute-options #functions
You need a small piece of code to run every time a new image is uploaded to a Cloud Storage bucket. It should generate a thumbnail. You don't want to build or manage a container. What's the simplest option?
+ A Cloud Run function with a Cloud Storage (object finalized) trigger :: Cloud Run functions run source code in response to events, and Google builds the container for you.
- A GKE CronJob that polls the bucket every minute :: Polling adds latency and you have to operate a cluster.
- A Compute Engine VM running a script with gsutil in a loop :: This is always-on infrastructure, it polls, and it needs patching.
- A BigQuery scheduled query :: BigQuery can't process image files.
> Event-driven, single-purpose code with no container to manage fits Cloud Run functions with an event trigger.

### ace-2003 [2.1] d2 #compute-options #compute-engine
A vendor application requires a specific Linux kernel module, must run on a custom OS image, and is licensed per physical core. Which compute option fits best?
- Cloud Run with a privileged container :: Cloud Run abstracts the OS and kernel, so you can't load custom kernel modules.
- GKE Autopilot with a custom node image :: Autopilot manages nodes and restricts node-level customization.
+ Compute Engine on sole-tenant nodes :: Compute Engine gives full control of the OS and kernel. Sole-tenant nodes provide dedicated physical servers for bring-your-own-license scenarios.
- Cloud Run functions with a custom runtime :: Functions run your code in a managed runtime without OS control.
> Kernel or OS control points to Compute Engine, and per-core licensing points to sole-tenant nodes.

### ace-2004 [2.1] d2 #agents #agent-runtime
Your team built an AI agent with the Agent Development Kit (ADK). They want a managed, scalable environment that handles sessions and long-term memory for the agent, without running their own Kubernetes cluster. Where should they deploy it?
- Compute Engine VM with a startup script :: This works, but you'd manage scaling, sessions, and memory yourself.
+ Agent Runtime on Gemini Enterprise Agent Platform :: Agent Runtime is a managed runtime for deploying and scaling agents, with managed sessions and Memory Bank for persistent context.
- Cloud Storage static website hosting :: Static hosting can't run agent code.
- Dataflow running the agent as a streaming job :: Dataflow runs data pipelines, not interactive agents.
> Managed hosting for ADK or other agents, with sessions and memory, means Agent Runtime on Gemini Enterprise Agent Platform.

### ace-2005 [2.1] d2 #availability-policy #gpu
You're creating a Compute Engine VM with an attached NVIDIA GPU. During host maintenance events, what availability policy must you set for the VM?
- On host maintenance: Migrate (live migration) :: Live migration isn't supported for most GPU VMs, which is why the setting is required.
+ On host maintenance: Terminate, typically with automatic restart enabled :: VMs with most attached GPUs can't be live migrated, so they must stop during maintenance. Automatic restart brings them back afterward.
- Provisioning model: Spot, so maintenance is skipped :: Spot affects preemption and pricing, not maintenance behavior.
- No setting is needed, since GPUs are hot-swapped transparently :: GPUs aren't hot-swapped during maintenance.
> GPU VMs use onHostMaintenance=TERMINATE, and automaticRestart=true brings them back.

### ace-2006 [2.1] d2 #oslogin #ssh
Your security team wants SSH access to Linux VMs managed through IAM instead of distributing SSH keys in project metadata, and wants access removed automatically when an employee leaves. What should you configure?
- Add each employee's public key to project-wide metadata :: Keys in metadata aren't tied to IAM, and they're easy to forget to remove.
+ Enable OS Login and grant the OS Login IAM roles to the users who need SSH :: OS Login links Linux accounts to Google identities and uses IAM. Removing a user from Cloud Identity revokes access.
- Create a bastion host with a shared admin key that's rotated quarterly :: Shared keys remove accountability.
- Route SSH through Cloud NAT so connections come from one audited IP :: Cloud NAT provides outbound internet access for private VMs. It doesn't manage SSH access.
> OS Login ties SSH access to IAM roles (osLogin or osAdminLogin) and supports 2-step verification.

### ace-2007 [2.1] d2 #ssh #metadata
A specific VM must not accept SSH keys that are stored in project-wide metadata, while other VMs in the project should still accept them. What should you do?
- Delete all project-wide SSH keys :: This affects every VM in the project.
+ Set block-project-ssh-keys=TRUE on that VM :: This instance-level setting ignores project-wide SSH keys for that VM only.
- Remove the VM's external IP address :: SSH could still be possible through IAP or a bastion, and the keys would still be accepted.
- Change the VM's service account to one without SSH roles :: Service accounts don't control which SSH keys a VM accepts.
> block-project-ssh-keys=TRUE on an instance ignores project-level metadata keys.

### ace-2008 [2.1] d2 #disks #hyperdisk
A database VM needs 80,000 IOPS, but only 500 GB of capacity. With Persistent Disk, performance scales with size, so you'd have to overprovision capacity. Which option lets you provision IOPS independently of capacity?
- pd-standard at 500 GB :: Standard PD is HDD-backed, has low IOPS, and performance still scales with size.
- pd-balanced at 500 GB :: Balanced PD performance also scales with size and has a lower ceiling.
+ Hyperdisk with provisioned IOPS :: Hyperdisk lets you provision capacity, IOPS, and throughput separately, which avoids overprovisioning capacity for performance.
- Cloud Storage FUSE mounts :: Object storage mounted with FUSE isn't suitable for low-latency database block I/O.
> Hyperdisk provisions performance independently of capacity. Persistent Disk performance scales with size.

### ace-2009 [2.1] d2 #disks #local-ssd
A rendering job needs a very fast scratch disk for temporary files. The data can be regenerated if lost. What's the most cost-effective high-performance choice?
- Regional Persistent Disk :: Regional PD adds synchronous replication across zones, which you don't need for scratch data.
+ Local SSD :: Local SSDs are physically attached and offer very high IOPS and low latency. Data doesn't persist when the VM stops, which is fine for scratch.
- pd-standard :: It's cheap, but too slow for heavy scratch I/O.
- Filestore Enterprise :: A managed NFS share adds network latency and cost you don't need for local scratch.
> Local SSD is ephemeral and very fast, which suits scratch and cache. Use persistent disks for anything that must survive.

### ace-2010 [2.1] d3 #disks #regional
A single-VM stateful application must survive a zonal outage with minimal data loss (RPO near zero), and you can accept a manual failover to a VM in another zone. Which storage option supports this?
- A daily snapshot schedule, restoring to a new VM in another zone :: Snapshots give an RPO of up to a day, not near zero.
+ Regional Persistent Disk, force-attached to a standby VM in the other zone :: Regional disks write synchronously to two zones, so you can attach the disk to a VM in the surviving zone after a failure.
- Local SSD in each zone, synchronized with rsync every minute :: Local SSDs aren't replicated and don't survive VM loss.
- Cloud Storage Nearline mounted with Cloud Storage FUSE :: Object storage isn't a block device for a running application.
> Regional PD or Hyperdisk HA gives synchronous cross-zone replication, near-zero RPO, and failover by force-attach.

### ace-2011 [2.1] d2 #mig #autoscaling
You need a web tier of identical VMs that automatically replaces unhealthy instances and scales between 2 and 20 instances based on CPU. What should you create?
- An unmanaged instance group with a load balancer health check :: Unmanaged groups don't autoscale or autoheal.
+ A managed instance group from a template, with autoscaling and autohealing :: MIGs create identical VMs from a template, autoscale on signals like CPU, and recreate instances that fail health checks.
- Ten individual VMs behind a load balancer :: There's no autoscaling or autohealing.
- A Cloud Scheduler job that runs gcloud to resize hourly :: This is crude and doesn't react to real-time load.
> Instance template plus MIG plus autoscaler plus autohealing health check is the standard elastic VM pattern.

### ace-2012 [2.1] d2 #mig #regional
Your MIG-based application must remain available if an entire zone fails. What should you do?
- Use a zonal MIG with a larger maximum size :: All instances would still be in one zone.
+ Use a regional MIG that spreads instances across zones :: Regional MIGs spread instances across zones and maintain capacity if one zone becomes unavailable.
- Use a Spot VM template so capacity is pulled from any zone :: Spot affects pricing and preemption, not zonal redundancy.
- Take hourly snapshots of every instance :: Snapshots help recovery but don't provide availability.
> Regional MIGs spread instances across zones for high availability.

### ace-2013 [2.1] d1 #spot
A fault-tolerant batch job processes images in parallel and can be restarted if interrupted. You want to minimize compute cost. What should you use?
+ Spot VMs :: Spot VMs offer deep discounts and can be preempted at any time. That's ideal for fault-tolerant, interruptible batch work.
- Sole-tenant nodes :: These are dedicated hosts and cost more.
- Committed use discounts for 3 years :: Commitments suit steady, long-running workloads, not occasional batch jobs.
- Large standard on-demand VMs :: This is the most expensive option for interruptible work.
> Fault-tolerant, interruptible work belongs on Spot VMs, which have no maximum runtime and can be preempted at any time.

### ace-2014 [2.1] d2 #custom-machine-types
Your application needs 6 vCPUs and 40 GB of memory. The predefined machine types either have too little memory or too many vCPUs. What's the most cost-effective option?
- Choose n2-highmem-8 and ignore the unused vCPUs :: You'd pay for extra vCPUs you don't need.
+ Create a custom machine type with 6 vCPUs and 40 GB of memory :: Custom machine types let you choose vCPU and memory amounts, so you pay only for what you need.
- Use two smaller VMs and split memory between them :: The application may not support that, and it adds complexity.
- Use an n2-standard-8 Spot VM to offset the extra vCPUs :: Spot reduces price but doesn't fix the shape mismatch, and it can be preempted.
> Custom machine types fit odd CPU-to-memory ratios, and extended memory goes beyond the standard ratio.

### ace-2015 [2.1] d1 #kubectl
You've just created a GKE cluster and want to use kubectl from your workstation. Which steps are required? (Choose two.)
+ Install kubectl and the gke-gcloud-auth-plugin (for example, gcloud components install kubectl gke-gcloud-auth-plugin) :: kubectl talks to the API server, and the auth plugin provides Google credentials to kubectl.
+ Run gcloud container clusters get-credentials CLUSTER_NAME --location=LOCATION :: This writes the cluster endpoint and auth configuration into your kubeconfig.
- Create a service account key and copy it into ~/.kube/config :: Keys aren't needed, since gcloud and the auth plugin use your identity.
- SSH into a node and run kubectl there :: You don't operate clusters this way, and Autopilot doesn't even allow it.
- Enable the Cloud Shell API :: Cloud Shell isn't required to use kubectl locally.
> kubectl plus gke-gcloud-auth-plugin plus get-credentials gives you a working kubeconfig.

### ace-2016 [2.1] d2 #gke #autopilot
A team wants to run containerized workloads on Kubernetes but doesn't want to manage nodes, node pools, or OS upgrades, and wants to pay for the resources their Pods request. Which GKE mode should they choose?
- GKE Standard with cluster autoscaler :: Standard still requires you to manage node pools and pay for whole nodes.
+ GKE Autopilot :: Autopilot manages nodes and infrastructure. You're billed mainly for the CPU, memory, and storage your Pods request.
- A single-zone Standard cluster with Spot nodes :: This is cheaper but still requires node management.
- Cloud Run for Anthos :: That isn't the right fit for the requirement. Autopilot is GKE's hands-off mode.
> Autopilot means Google manages the nodes and you pay per Pod resource request. Standard means you manage node pools and pay per node.

### ace-2017 [2.1] d2 #gke #regional
Your production GKE cluster must keep its control plane and workloads available during a zone outage. How should you create the cluster?
- Zonal cluster with a large node pool :: The control plane and nodes would all be in one zone.
- Multi-zonal cluster :: Nodes spread across zones, but the control plane stays in one zone.
+ Regional cluster :: Regional clusters run control plane replicas and nodes in several zones for higher availability. Autopilot clusters are always regional.
- Two zonal clusters in one zone :: A single zone is still a single point of failure.
> For HA, use a regional GKE cluster, which replicates both the control plane and the nodes.

### ace-2018 [2.1] d2 #gke #private
Security requires that GKE nodes have no external IP addresses, while nodes can still pull images from Artifact Registry and reach Google APIs. What should you configure?
- A public cluster with firewall rules denying ingress to nodes :: Nodes would still have external IPs, which violates the requirement.
+ A private cluster, with Private Google Access enabled on the subnet :: Private nodes have no external IPs. Private Google Access lets them reach Google APIs, including Artifact Registry, and Cloud NAT provides other egress.
- Use Container-Optimized OS images, which drop external IPs from nodes :: The OS choice doesn't control whether nodes get external IPs.
- Put the cluster in the default VPC so Google APIs stay reachable :: Network choice alone doesn't make nodes private.
> Private nodes plus Private Google Access (plus Cloud NAT for the internet) keeps nodes off the internet but able to pull images.

### ace-2019 [2.1] d1 #gke #deploy
You have a deployment.yaml file that describes your application's Deployment. How do you deploy or update it on your GKE cluster?
+ kubectl apply -f deployment.yaml :: kubectl apply creates or updates resources declaratively from the manifest.
- gcloud container clusters create --file=deployment.yaml :: That command creates clusters, not workloads.
- gcloud run deploy --source=deployment.yaml :: That deploys to Cloud Run, not GKE.
- kubectl get -f deployment.yaml :: get only reads resources.
> kubectl apply -f is the declarative way to create or update Kubernetes objects.

### ace-2020 [2.1] d2 #gke #service
You deployed a web application on GKE and need to expose it to the internet on a public IP through a Google Cloud load balancer. What's the simplest Kubernetes resource to create?
- A Service of type ClusterIP :: ClusterIP is internal only.
+ A Service of type LoadBalancer :: A LoadBalancer Service provisions an external passthrough Network Load Balancer. Ingress or Gateway provision Application Load Balancers.
- A ConfigMap with the public IP :: ConfigMaps store configuration, not networking.
- A PersistentVolumeClaim :: PVCs request storage.
> Use LoadBalancer for L4 external exposure, and Ingress or Gateway for L7 HTTP(S) routing, TLS, and path rules.

### ace-2021 [2.1] d2 #eventarc #events
You want a Cloud Run service to be invoked whenever a Compute Engine VM is created anywhere in the project, based on the Admin Activity audit log entry. What should you use?
- A Cloud Storage notification on the project's default bucket :: This handles bucket events only.
+ An Eventarc audit-log trigger for instance inserts, targeting the service :: Eventarc can route events from audit logs, Pub/Sub, Cloud Storage, and more to Cloud Run.
- Cloud Scheduler hitting the service every minute to list VMs :: Polling is inefficient and delayed.
- A BigQuery scheduled query over the audit log export :: This isn't event-driven and is unrelated to VM creation.
> Eventarc routes Google Cloud events, including audit-log-based ones, to Cloud Run, GKE, or Workflows.

### ace-2022 [2.1] d2 #pubsub #cloud-run
Multiple microservices publish order events. A Cloud Run service must process each event and retry automatically if processing fails. What's a good serverless design?
+ Publish to a Pub/Sub topic with a push subscription to the Cloud Run service :: Pub/Sub decouples producers from consumers and retries unacknowledged messages. A dead-letter topic can capture poison messages.
- Write events to a Cloud Storage bucket and have the service poll it :: Polling is slower and you'd have to build retry logic yourself.
- Call the Cloud Run service directly from every producer and retry in each producer :: This couples services tightly and duplicates retry logic.
- Insert events into a Cloud SQL table that the service polls as a queue :: A relational database is a poor queue at scale.
> Pub/Sub push to Cloud Run gives decoupled, retried, at-least-once delivery, and a dead-letter topic handles failures.

### ace-2023 [2.1] d2 #gpu #tpu
A research team is training very large transformer models in JAX and wants the best price-performance for large matrix operations at scale. Another team needs CUDA-based libraries for 3D rendering. Which accelerators fit each team?
- GPUs for both, since they run everything :: GPUs work for both, but TPUs are purpose-built for large-scale JAX/TensorFlow training and often give better price-performance there.
+ TPUs for JAX training, GPUs for CUDA rendering :: TPUs are optimized for large tensor and matrix workloads in JAX, TensorFlow, and PyTorch/XLA. CUDA software requires NVIDIA GPUs.
- TPUs for both, for the best price :: TPUs don't run CUDA workloads.
- Local SSDs for both, to speed up I/O :: Local SSDs are storage, not accelerators.
> TPUs suit large-scale ML on JAX, TensorFlow, or PyTorch/XLA. GPUs suit CUDA, graphics, and broad framework support.

### ace-2024 [2.1] d2 #vm-manager
You manage 300 Linux and Windows VMs and need to apply OS patches on a schedule and get compliance reports, without logging into each VM. What should you use?
- A startup script that runs apt upgrade :: This only runs at boot, doesn't cover Windows, and gives no reporting.
+ VM Manager patch deployments across the fleet :: VM Manager schedules patch jobs across fleets, supports Linux and Windows, and reports compliance.
- Cloud Deploy pipelines that push OS packages :: Cloud Deploy releases application versions, not OS patches.
- Recreate VMs from a new image every night :: This is possible for immutable fleets but disruptive, and it gives no compliance reporting.
> VM Manager handles OS patching, OS inventory, and OS policies at fleet scale.

### ace-2025 [2.1] d2 #mig #updates
You need to roll out a new instance template to a managed instance group of 10 VMs without downtime, replacing at most 2 VMs at a time. What should you do?
- Delete the MIG and recreate it with the new template :: This causes downtime.
+ Start a MIG rolling update to the new template with max-unavailable set to 2 :: Rolling updates gradually replace instances with the new template and respect max-surge and max-unavailable limits.
- Edit each VM's metadata to point at the new template, two at a time :: VMs in a MIG should be updated through the template, not individually.
- Stop all VMs, change the template, and start them :: This causes downtime.
> MIG rolling updates use max-surge and max-unavailable to control the pace. Canary updates can target a subset first.

### ace-2026 [2.1] d3 #mig #stateful
A MIG runs a legacy app where each VM needs to keep its own data disk and hostname through autohealing and updates. What should you configure?
- An unmanaged instance group with autohealing :: You'd lose autohealing and automated updates.
+ A stateful MIG that preserves each instance's disk :: Stateful MIGs keep instance names, attached disks, and metadata across recreation, autohealing, and updates.
- Local SSDs as the data disks in the template :: Local SSD data doesn't survive recreation.
- A regional MIG with autoscaling :: Autoscaling would add and remove instances, which conflicts with per-instance state.
> Stateful MIGs preserve disks, names, and metadata for stateful apps while keeping autohealing.

### ace-2027 [2.1] d2 #cloud-run #config
Your Cloud Run service must always have at least two instances warm to avoid cold-start latency for user-facing traffic, and at most 50 instances to protect a downstream database. What should you configure?
- CPU always allocated, with 50 max requests :: This affects CPU outside requests, not instance counts.
+ Minimum instances 2, maximum instances 50 :: Min instances keep containers warm, and max instances cap scaling to protect downstream systems.
- Concurrency 2, maximum concurrency 50 :: Concurrency sets requests per instance, not the number of instances.
- A regional MIG behind Cloud Run :: Cloud Run doesn't use MIGs that way.
> Cloud Run min instances reduce cold starts and max instances protect downstream systems.

### ace-2028 [2.1] d3 #compute-options #multiple
Which two workloads are good fits for Cloud Run? (Choose two.)
+ A containerized HTTP API that scales from zero to thousands of requests per second :: Request-driven autoscaling with scale to zero is Cloud Run's core use case.
- A workload that needs a custom kernel module and GPUs with full OS access :: Kernel-level control needs Compute Engine. Cloud Run abstracts the OS.
+ A containerized batch task that runs to completion nightly, using Cloud Run jobs :: Cloud Run jobs run containers to completion and can be scheduled with Cloud Scheduler.
- A stateful database that needs persistent block storage attached to the instance :: Cloud Run isn't designed to host databases on persistent block devices. Use a managed database or Compute Engine.
- A Windows Server application that needs RDP access :: Cloud Run runs Linux containers. It doesn't offer Windows VMs or RDP.
> Cloud Run services handle requests, and Cloud Run jobs run tasks to completion. Neither fits OS-level control or databases.

### ace-2029 [2.2] d1 #storage-classes
You need to store regulatory archives that are accessed less than once a year but must be kept for 7 years at the lowest storage cost. Which Cloud Storage class should you use?
- Standard :: This has the highest storage cost, so it suits frequent access.
- Nearline :: Nearline is for data accessed about once a month.
- Coldline :: Coldline is for data accessed about once a quarter.
+ Archive :: Archive has the lowest storage price for data accessed less than once a year. It has a 365-day minimum storage duration and higher retrieval costs.
> Minimum storage durations: Standard none, Nearline 30 days, Coldline 90 days, Archive 365 days.

### ace-2030 [2.2] d2 #storage-classes
Monthly analytics reports are written once and then read about once a month for audits. You want the cheapest class that fits this access pattern. Which should you choose?
- Archive :: Retrieval costs and the 365-day minimum make Archive a poor fit for monthly access.
- Standard :: Standard works but has a higher storage price than needed for monthly access.
+ Nearline :: Nearline is designed for data accessed roughly once a month or less, with a 30-day minimum storage duration.
- Coldline :: Coldline suits quarterly access, and monthly reads would add retrieval costs.
> Match the class to access frequency: about monthly is Nearline, about quarterly is Coldline, and yearly or less is Archive.

### ace-2031 [2.2] d2 #autoclass
A bucket contains millions of objects with unpredictable access patterns. Some are hot for weeks and others are never read again. You don't want to write lifecycle rules. What should you enable?
- Requester Pays :: Requester Pays shifts egress and operation costs to the requester. It doesn't optimize storage class.
+ Autoclass :: Autoclass automatically moves each object to colder classes based on its access, and back to Standard when it's accessed, with no retrieval or early-deletion charges.
- Object Versioning :: Versioning keeps old versions, which increases cost.
- Turbo replication :: Turbo replication speeds up dual-region replication and doesn't change storage class.
> Use Autoclass for unpredictable access patterns, and lifecycle rules for predictable, age-based transitions.

### ace-2032 [2.2] d2 #database-choice #spanner
You need a relational database for a global retail application with ACID transactions, strong consistency across continents, horizontal scaling beyond a single machine, and 99.999% availability. Which service should you choose?
- Cloud SQL for PostgreSQL with read replicas :: Cloud SQL scales vertically and has a regional primary, and cross-region replicas are asynchronous.
- Bigtable :: Bigtable is NoSQL and doesn't offer relational multi-row ACID transactions with SQL joins.
+ Spanner :: Spanner is a globally distributed, horizontally scalable relational database with strong consistency and up to 99.999% availability for multi-region configurations.
- Firestore :: Firestore is a document database, not a relational one.
> Global, relational, strongly consistent, and horizontally scalable means Spanner.

### ace-2033 [2.2] d2 #database-choice #bigtable
An IoT platform ingests millions of sensor readings per second and needs single-digit-millisecond reads by device ID and timestamp. The data isn't relational. Which database fits best?
- Cloud SQL :: Cloud SQL can't handle this write throughput.
+ Bigtable :: Bigtable is a wide-column NoSQL database built for high-throughput, low-latency workloads such as time series and IoT, with row keys like deviceId#timestamp.
- BigQuery :: BigQuery is for analytics, not high-QPS operational lookups.
- Memorystore :: An in-memory cache isn't a durable primary store for petabytes of telemetry.
> Massive write throughput, key-based low-latency reads, and time series data point to Bigtable.

### ace-2034 [2.2] d1 #database-choice #firestore
A mobile app needs a serverless database that syncs data in real time across user devices and supports offline mode. Which service should you choose?
+ Firestore :: Firestore is a serverless document database with real-time listeners and offline support in its mobile and web SDKs.
- Cloud SQL for MySQL :: There's no real-time sync or offline client SDK.
- Bigtable :: Bigtable has no mobile client sync and is overkill for this.
- Spanner :: Spanner is powerful, but it doesn't provide real-time mobile sync.
> Firestore is a document database with real-time sync and offline mobile/web SDKs.

### ace-2035 [2.2] d1 #database-choice #bigquery
Analysts want to run ad hoc SQL over 50 TB of historical sales data without managing infrastructure. Which service should you use?
- Cloud SQL :: Cloud SQL is an operational database and isn't designed for multi-terabyte analytics.
+ BigQuery :: BigQuery is a serverless, petabyte-scale data warehouse for SQL analytics.
- Firestore :: Firestore is for application documents, not analytics.
- Memorystore :: Memorystore is an in-memory cache.
> Analytical SQL over large datasets with no infrastructure points to BigQuery.

### ace-2036 [2.2] d2 #database-choice #alloydb
You're migrating a demanding PostgreSQL OLTP application that also runs heavy analytical queries on the same data. You want full PostgreSQL compatibility and much better performance than standard PostgreSQL, with a managed service. Which should you choose?
- Cloud SQL for MySQL :: This is the wrong engine.
+ AlloyDB for PostgreSQL :: AlloyDB is PostgreSQL-compatible and optimized for high transactional performance, with a columnar engine that speeds up analytical queries.
- Bigtable :: Bigtable isn't PostgreSQL-compatible.
- Firestore in Datastore mode :: This isn't relational and isn't PostgreSQL-compatible.
> AlloyDB is managed, PostgreSQL-compatible, and high-performance, with a columnar engine for HTAP.

### ace-2037 [2.2] d1 #memorystore
Your application repeatedly reads the same product catalog data from Cloud SQL, causing high latency and load. You want sub-millisecond reads for hot keys. What should you add?
- A Cloud SQL read replica in another region :: Replicas offload reads, but latency is still database-level, not sub-millisecond, and cross-region adds latency.
+ Memorystore as a cache in front of Cloud SQL :: An in-memory cache gives sub-millisecond reads for frequently accessed data and reduces database load.
- Cloud Storage objects holding the catalog :: Object storage isn't a low-latency cache.
- BigQuery BI Engine in front of Cloud SQL :: BI Engine speeds up BigQuery dashboards, not Cloud SQL application reads.
> Memorystore is a managed in-memory cache that cuts database load and latency.

### ace-2038 [2.2] d2 #pubsub #dataflow
You need to ingest clickstream events in real time, transform and enrich them, and write results to BigQuery with exactly-once processing semantics in the pipeline. Which combination fits best?
+ Pub/Sub for ingestion and Dataflow streaming into BigQuery :: Pub/Sub provides scalable ingestion, and Dataflow provides managed stream processing with exactly-once semantics and BigQuery sinks.
- Cloud Storage and a nightly batch load :: This isn't real time.
- Cloud SQL triggers that write to BigQuery :: These won't scale for clickstream volumes and aren't a streaming ETL tool.
- Memorystore as a buffer, with cron jobs loading BigQuery :: This isn't a durable or scalable streaming pipeline.
> The streaming pattern is Pub/Sub → Dataflow → BigQuery.

### ace-2039 [2.2] d2 #kafka
Your company has dozens of producer and consumer applications written against the Apache Kafka API. They want to move to Google Cloud without rewriting clients or operating Kafka brokers themselves. What should they use?
- Pub/Sub, rewriting all clients to the Pub/Sub API :: This works but requires the rewrite they want to avoid.
+ Google Cloud Managed Service for Apache Kafka :: It runs managed Apache Kafka clusters, so existing Kafka clients keep working and Google handles broker operations.
- Self-managed Kafka on Compute Engine :: Clients stay compatible, but the team still has to operate brokers.
- Cloud Tasks :: Cloud Tasks is for dispatching HTTP tasks, not Kafka streams.
> For Kafka API compatibility without operating brokers, use Managed Service for Apache Kafka. For cloud-native messaging, use Pub/Sub.

### ace-2040 [2.2] d2 #filestore #file-storage
Several Compute Engine VMs and GKE Pods need to share a POSIX file system over NFS for a content management system. Which managed service should you use?
- Cloud Storage with signed URLs :: This isn't a POSIX NFS file system.
+ Filestore :: Filestore provides managed NFS file shares that many VMs and GKE workloads can mount concurrently.
- Persistent Disk in read-write mode attached to all VMs :: Standard PD can't be attached read-write to many VMs at once. Multi-writer mode is limited and needs a cluster-aware file system.
- Local SSD :: Local SSDs aren't shared between VMs.
> Shared NFS access for VMs or GKE points to Filestore. For SMB or enterprise NAS features, consider NetApp Volumes.

### ace-2041 [2.2] d2 #netapp #smb
A Windows-based application requires SMB file shares with snapshots and enterprise NAS features similar to what you run on-premises. Which managed Google Cloud service fits?
- Filestore Basic :: Filestore serves NFS, not SMB.
+ NetApp Volumes :: NetApp Volumes provides fully managed NFS and SMB volumes with enterprise data management features such as snapshots and replication.
- Cloud Storage FUSE :: FUSE mounts buckets for Linux and isn't an SMB share.
- Bigtable :: Bigtable isn't a file system.
> NetApp Volumes covers SMB and NFS with enterprise NAS features.

### ace-2042 [2.2] d3 #lustre #hpc
An AI training cluster with thousands of GPUs needs a parallel file system that delivers very high throughput to many clients at once. Which storage product is designed for this?
- Cloud Storage Standard with gcloud storage cp in each job :: This works for staging data, but it isn't a parallel POSIX file system for high-throughput shared access.
+ Google Cloud Managed Lustre :: Managed Lustre is a fully managed parallel file system for HPC and AI/ML workloads that need very high aggregate throughput.
- Filestore Basic HDD :: Its throughput is far too low for thousands of GPUs.
- Memorystore :: Memorystore is an in-memory key-value cache, not a file system.
> Managed Lustre is a parallel file system for HPC and AI training at scale.

### ace-2043 [2.2] d1 #upload #cli
You need to upload a local directory of 5,000 files to a Cloud Storage bucket from your laptop. Which command should you use?
+ gcloud storage cp -r ./data gs://my-bucket/data :: gcloud storage cp copies files recursively and parallelizes transfers automatically.
- gcloud compute scp ./data gs://my-bucket :: compute scp copies to VMs, not buckets.
- bq load gs://my-bucket ./data :: bq load loads data into BigQuery tables.
- kubectl cp ./data gs://my-bucket :: kubectl cp copies to and from Pods.
> gcloud storage cp, rsync, and ls are the current CLI for Cloud Storage (gsutil is legacy).

### ace-2044 [2.2] d2 #storage-transfer
You need to migrate 300 TB from an Amazon S3 bucket to Cloud Storage and then sync new objects daily for a month, with minimal custom code. What should you use?
- gcloud storage cp from a laptop over VPN :: This is too slow and unreliable for 300 TB.
+ Storage Transfer Service with a daily schedule :: Storage Transfer Service is managed, scalable, and schedulable, and it supports S3, Azure, HTTP lists, and on-premises sources.
- Transfer Appliance shipped from AWS :: The data is already in the cloud. An appliance is for offline transfer from your own data centers.
- BigQuery Data Transfer Service :: This loads data into BigQuery from supported sources. It doesn't copy objects between buckets.
> Storage Transfer Service handles cloud-to-cloud, scheduled, and agent-based on-premises transfers.

### ace-2045 [2.2] d2 #transfer-appliance
Your data center holds 2 PB of archival data, and your internet link is only 1 Gbps. You need the data in Cloud Storage within a few weeks. What should you do?
- gcloud storage rsync over the existing link :: At 1 Gbps, 2 PB takes about six months.
- Storage Transfer Service for on-premises data :: It still uses the same slow network link.
+ Order Transfer Appliance and ship the data :: Transfer Appliance is a physical device for moving very large datasets offline when network transfer would take too long.
- Cloud Interconnect provisioned for a week :: Provisioning takes time, and it's still bandwidth-bound and costly for a one-time move.
> Huge data plus limited bandwidth means an offline Transfer Appliance.

### ace-2046 [2.2] d2 #location #redundancy
Your company needs Cloud Storage data to survive the loss of an entire region, with a guaranteed fast replication target of 15 minutes between two specific regions you choose. What should you configure?
- A regional bucket with Object Versioning :: Versioning protects against overwrites, not regional loss.
- A multi-region bucket with default replication :: Multi-region gives geo-redundancy, but you don't choose the regions and the default replication isn't the 15-minute target.
+ A dual-region bucket with turbo replication enabled :: Dual-region stores data in two specific regions, and turbo replication targets an RPO of 15 minutes.
- Two regional buckets with a weekly copy job :: A weekly copy doesn't meet a 15-minute RPO.
> Dual-region plus turbo replication gives a 15-minute RPO between two regions you choose.

### ace-2047 [2.2] d2 #cloud-sql #ha
Your Cloud SQL for MySQL instance must automatically fail over if its zone fails. What should you configure?
- A read replica in the same zone :: A same-zone replica doesn't protect against zonal failure, and replicas don't fail over automatically.
+ High availability (regional) configuration :: Cloud SQL HA uses synchronous replication to a standby in a second zone and fails over automatically.
- Automated daily backups :: Backups help recovery but don't provide automatic failover.
- An external replica on-premises :: This adds complexity and doesn't give automatic failover.
> Cloud SQL HA means a regional primary plus standby with automatic failover. Read replicas are for scaling reads and disaster recovery.

### ace-2048 [2.2] d3 #database-choice #multiple
A company is designing several workloads. Which two pairings of workload to database are appropriate? (Choose two.)
+ An inventory system with ACID transactions across rows, a single region, and a few TB on MySQL → Cloud SQL :: Cloud SQL is a managed MySQL, PostgreSQL, or SQL Server service for regional relational workloads of this size.
- Ad hoc analytics over petabytes of logs → Memorystore :: Memorystore is an in-memory cache, and analytics belongs in BigQuery.
+ User session caching with sub-millisecond reads → Memorystore :: Session caching is a classic in-memory cache use case.
- A global relational ledger needing horizontal scale → Firestore :: Firestore isn't relational. Global relational workloads fit Spanner.
- A high-throughput time series with millions of writes per second → Cloud SQL :: Cloud SQL can't reach this write scale. Bigtable fits.
> Know the decision tree: relational regional is Cloud SQL or AlloyDB, relational global is Spanner, NoSQL at scale is Bigtable, documents are Firestore, analytics is BigQuery, and cache is Memorystore.

### ace-2049 [2.2] d2 #bigquery #load
You need to load a 20 GB CSV file in Cloud Storage into a new BigQuery table, letting BigQuery detect the schema. Which command should you use?
+ bq load --autodetect --source_format=CSV mydataset.t gs://bucket/file.csv :: bq load imports files from Cloud Storage, and --autodetect infers the schema.
- gcloud storage cp gs://bucket/file.csv bq://mydataset.mytable :: gcloud storage can't write to BigQuery.
- bq query --autodetect "LOAD gs://bucket/file.csv" :: That isn't valid syntax. Loading uses bq load or the LOAD DATA statement.
- gcloud sql import csv mydataset gs://bucket/file.csv :: That imports into Cloud SQL, not BigQuery.
> bq load (or LOAD DATA in SQL) imports from Cloud Storage. Use external tables to query data in place.

### ace-2050 [2.2] d2 #storage #static-website
You want to host a static marketing website (HTML, CSS, images) at the lowest cost with HTTPS on a custom domain and global caching. What should you do?
- Run Nginx on a Compute Engine VM with a static IP and a certificate :: A VM is more expensive and needs patching for static content.
+ A Cloud Storage backend bucket behind an Application Load Balancer with Cloud CDN :: Backend buckets serve Cloud Storage content through the load balancer with HTTPS on your domain, and Cloud CDN caches it globally.
- Deploy a GKE cluster with an Ingress and a managed certificate :: This is overkill for static files.
- Store the HTML in Cloud SQL and serve it from Cloud Run functions :: Databases aren't for serving static sites.
> Static site: Cloud Storage backend bucket, Application Load Balancer, Cloud CDN, and a managed SSL certificate.

### ace-2051 [2.2] d2 #pubsub
An application must fan out each published message to three independent consumers that process at different speeds. How should you design this with Pub/Sub?
- One subscription shared by all three consumers :: Consumers on a shared subscription split messages between them. Each message goes to only one consumer.
+ One topic with a subscription per consumer :: Every subscription receives a copy of each message, so consumers process independently.
- Three topics, and the publisher writes to each :: This works but duplicates publishing logic. Multiple subscriptions on one topic is the intended fan-out pattern.
- A single pull subscription with ordering keys :: Ordering keys control ordering, not fan-out.
> Fan-out means one topic with many subscriptions. Load sharing means many workers on one subscription.

### ace-2052 [2.2] d1 #storage #durability
Which statement about Cloud Storage location types is correct?
- Regional buckets replicate data across multiple regions automatically :: Regional buckets store data redundantly across zones within one region.
+ Dual-region and multi-region buckets span regions, and regional buckets don't :: This is the key distinction for regional failure protection and data residency.
- Archive and Coldline classes are only available in multi-region locations :: Every class is available in all location types.
- Dual-region buckets cost less than regional buckets for the same class :: Dual-region typically costs more, because data is stored in two regions.
> Regional means zones within one region. Dual-region means two specific regions. Multi-region means a large geographic area.
