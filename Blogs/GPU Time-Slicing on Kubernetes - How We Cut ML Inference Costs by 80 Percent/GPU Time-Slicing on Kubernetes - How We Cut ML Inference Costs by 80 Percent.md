# GPU Time-Slicing on Kubernetes: How We Cut ML Inference Costs by 80%

> The problem wasn't the model. It wasn't the infrastructure. It was how we were *using* the GPUs we already had.

---

## The Situation

We were running 15+ image recognition models in production. Each model was containerized, each container requested a **dedicated GPU**, and each GPU was idle somewhere between 60–80% of the time.

The math was brutal.

We were paying for full GPU node hours to serve sporadic inference requests. SageMaker endpoints, left running 24/7, charged us whether the model was doing work or not. The cost per prediction was embarrassingly high, and the business was starting to notice.

The directive was simple: **fix it, or justify it.**

---

## Why Dedicated GPUs Are the Wrong Default for Inference

When teams first containerize ML models, the instinct is to request a whole GPU:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
```

This makes sense during training — you want maximum memory bandwidth, no interference from other processes. But inference is a completely different workload profile:

- Batch sizes are small (often single requests)
- GPU utilization per request is low (10–30% typical)
- Requests are bursty, not continuous

A dedicated GPU for an inference pod is like booking a private jet for a 10-minute commute. Technically works. Economically indefensible.

---

## The Solution: GPU Time-Slicing

NVIDIA's GPU time-slicing allows a single physical GPU to be shared across multiple pods — each pod gets a slice of compute time, not exclusive access.

Think of it like CPU time-sharing, but for GPUs.

### How It Works

You configure the NVIDIA device plugin with a `ConfigMap` that specifies how many replicas (slices) each GPU should expose:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: time-slicing-config
  namespace: nvidia-device-plugin
data:
  any: |-
    version: v1
    flags:
      migStrategy: none
    sharing:
      timeSlicing:
        resources:
        - name: nvidia.com/gpu
          replicas: 4
```

With `replicas: 4`, a node with 1 physical GPU now advertises **4 allocatable GPU resources** to Kubernetes. Four pods can each request `nvidia.com/gpu: 1` and all land on the same physical card.

### Applying It to the Node Pool

Label the nodes to use this config:

```bash
kubectl label node <node-name> nvidia.com/device-plugin.config=any
```

Update the NVIDIA device plugin DaemonSet to watch for the config:

```yaml
env:
  - name: CONFIG_FILE
    value: /etc/nvidia/config.yaml
```

No kernel changes. No driver reinstall. Just config.

---

## What We Actually Deployed

Our setup on Amazon EKS:

| Layer | Choice | Why |
|---|---|---|
| GPU nodes | `g4dn.xlarge` (T4 GPU) | Cost-effective, enough VRAM for our models |
| Time-slice ratio | 4 replicas per GPU | Balanced utilisation after benchmarking |
| Autoscaler | Karpenter | Provision GPU nodes only when needed |
| Serving framework | FastAPI + custom loader | Pull model from S3 at startup |
| Orchestration | Kubernetes (EKS) | Replace SageMaker endpoints entirely |

The previous architecture: SageMaker endpoints, always-on, one per model.  
The new architecture: EKS pods, time-sliced GPU, scaled to zero when idle.

---

## The Karpenter Piece

Time-slicing solves *density*. Karpenter solves *cost when idle*.

With SageMaker, you pay even when traffic drops to zero. With EKS + Karpenter, GPU nodes **only exist when pods need them**:

```yaml
apiVersion: karpenter.sh/v1alpha5
kind: Provisioner
metadata:
  name: gpu-provisioner
spec:
  requirements:
    - key: node.kubernetes.io/instance-type
      operator: In
      values: ["g4dn.xlarge", "g4dn.2xlarge"]
    - key: karpenter.sh/capacity-type
      operator: In
      values: ["spot", "on-demand"]
  limits:
    resources:
      nvidia.com/gpu: "8"
  ttlSecondsAfterEmpty: 60
```

`ttlSecondsAfterEmpty: 60` means if a GPU node has been idle for 60 seconds, Karpenter terminates it. No manual intervention. No forgotten instances bleeding money overnight.

---

## The Numbers

| Metric | Before (SageMaker) | After (EKS + Time-Slicing) |
|---|---|---|
| Monthly GPU cost | Baseline | **~20% of baseline** |
| Models per GPU node | 1 | 4–6 |
| Idle cost | High (always-on endpoints) | Near zero (scale to zero) |
| Cold start latency | ~0s (always warm) | ~15–30s (acceptable for our SLA) |
| Operational control | Low (managed service) | Full |

**~80% cost reduction.** That's not rounding. That's what happened.

---

## What You Give Up

This isn't free. There are real tradeoffs you need to understand:

### 1. No Memory Isolation
Time-sliced pods share the GPU's memory space. If one pod's model is large, it can OOM-kill the others. We worked around this by grouping models of similar size on the same node.

### 2. Cold Starts
Scale-to-zero means the first request after a quiet period wakes up a node. We accepted 15–30 second cold starts for non-critical models. For latency-sensitive paths, we kept one warm pod running.

### 3. Performance Variability
Under high concurrent load, pods compete for GPU time. For our workload (image recognition, mostly async), this was acceptable. For real-time applications with strict p99 latency requirements — benchmark carefully before committing.

### 4. Not Suitable for Training
Time-slicing is an inference pattern. Never use it for training jobs. Use dedicated nodes for that.

---

## The Operational Lesson

The biggest win wasn't the GPU configuration. It was the **mental shift**.

We stopped treating infrastructure as static. SageMaker endpoints felt permanent once deployed. EKS pods are ephemeral by design — they spin up, do work, and disappear.

When your infrastructure matches the actual shape of your workload (bursty inference, not constant), the cost naturally follows.

---

## Key Takeaways

- **Time-slicing** lets multiple pods share a single GPU — right config, zero kernel changes
- **Karpenter** provisions GPU nodes on-demand and tears them down when idle
- **Combining both** drops inference costs dramatically without sacrificing reliability
- **Tradeoffs exist**: no memory isolation, cold starts, performance variability under load
- **Never use time-slicing for training** — only inference workloads

---

*This is a real architecture we built and operated in production on Amazon EKS. Numbers are approximate to protect client data, but directionally accurate.*

---

**Tags:** `#Kubernetes` `#MLOps` `#GPU` `#EKS` `#Karpenter` `#CostOptimization` `#NVIDIA` `#CloudEngineering` `#AWS` `#Inference` `#MachineLearning`
