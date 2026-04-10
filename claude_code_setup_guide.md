# Claude Code + AWS Bedrock Setup Guide (Windows)

## Your Current System Audit

| Item | Status | Notes |
|:-----|:-------|:------|
| Claude Code CLI | ✅ Installed | `%USERPROFILE%\.claude\` exists |
| `%USERPROFILE%\.claude\settings.json` | ✅ Exists | Currently set to `opus[1m]` model |
| AWS CLI | ❌ **Not installed** | `aws` command not found |
| `%USERPROFILE%\.aws\config` | ❌ **Missing** | Directory exists but no config/credentials files |
| `%USERPROFILE%\.aws\credentials` | ❌ **Missing** | No credentials configured |
| Node.js / npm | ❌ **Not found** in PATH | May be needed for Claude Code updates |
| Bedrock env vars | ❌ **Not set** | No `CLAUDE_CODE_USE_BEDROCK`, `AWS_REGION`, etc. |
| Shell | ✅ PowerShell | Used for running commands |

---

## Required Environment Variables

Here's every environment variable relevant to Bedrock, what it does, and whether it's required:

| Variable | Required? | Description | Example Value |
|:---------|:----------|:------------|:--------------|
| `CLAUDE_CODE_USE_BEDROCK` | ✅ **Required** | Enables Bedrock integration | `1` |
| `AWS_REGION` | ✅ **Required** | AWS region for Bedrock (Claude Code does NOT read from `.aws\config`) | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | ✅ Required (Option B) | Your IAM access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | ✅ Required (Option B) | Your IAM secret key | `wJalr...` |
| `AWS_SESSION_TOKEN` | ⚠️ Conditional | Only needed for temporary/STS credentials | `FwoGZX...` |
| `AWS_PROFILE` | ⚠️ Conditional | Only if using named profiles / SSO (Option C) | `my-bedrock-profile` |
| `AWS_BEARER_TOKEN_BEDROCK` | ⚠️ Conditional | Only if using Bedrock API keys (Option E) | `your-api-key` |
| `ANTHROPIC_MODEL` | ⚠️ Optional | Override the primary model | `us.anthropic.claude-sonnet-4-6` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | ⚠️ Optional | Pin Opus version | `us.anthropic.claude-opus-4-6-v1` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | ⚠️ Optional | Pin Sonnet version | `us.anthropic.claude-sonnet-4-6` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | ⚠️ Optional | Pin Haiku (small/fast) version | `us.anthropic.claude-haiku-4-5-20251001-v1:0` |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | ⚠️ Optional | Different region for Haiku model | `us-west-2` |
| `ANTHROPIC_BEDROCK_BASE_URL` | ⚠️ Optional | Custom Bedrock endpoint URL | `https://bedrock-runtime.us-east-1.amazonaws.com` |
| `DISABLE_PROMPT_CACHING` | ⚠️ Optional | Disable prompt caching (not available in all regions) | `1` |

---

## Step-by-Step Setup

### Step 1: Install AWS CLI

You don't have the AWS CLI installed. Install it via PowerShell:

```powershell
# Download and install the AWS CLI using msiexec
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# Verify
aws --version
```

After installation, you may need to restart your terminal.

---

### Step 2: Get Your AWS Credentials

You need an AWS IAM user or role with Bedrock permissions. You have **5 options** for authentication — pick the one that matches your setup:

#### Option A: Access Key + Secret Key (Simplest for personal use)

1. Go to **AWS Console** → **IAM** → **Users** → your user → **Security credentials**
2. Click **Create access key**
3. Copy the **Access Key ID** and **Secret Access Key**

You'll need these values:
- `AWS_ACCESS_KEY_ID` → from step 2
- `AWS_SECRET_ACCESS_KEY` → from step 2

#### Option B: SSO Profile (If your org uses AWS SSO / IAM Identity Center)

```powershell
aws configure sso
# Follow the prompts to set up your SSO profile
# Then log in:
aws sso login --profile=your-profile-name
```

#### Option C: Bedrock API Key (Simplest method, no full AWS creds needed)

Get a Bedrock API key from your AWS console. You'll use `AWS_BEARER_TOKEN_BEDROCK`.

---

### Step 3: Enable Anthropic Models in Bedrock

1. Go to [Amazon Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Select your region (e.g., **us-east-1**)
3. Click **Model catalog** in the sidebar
4. Find **Anthropic** models (Claude Sonnet 4.6, Claude Opus 4.6, Claude Haiku 4.5)
5. Click on the model → **Submit use case form**
6. Access is granted **immediately** after submission

> [!IMPORTANT]
> You must submit the use case form **at least once per AWS account**. Without this, you'll get permission errors.

---

### Step 4: Create the IAM Policy

Your IAM user/role must have these permissions. Create a policy in **IAM** → **Policies** → **Create policy** → **JSON**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowModelAndInferenceProfileAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListInferenceProfiles"
      ],
      "Resource": [
        "arn:aws:bedrock:*:*:inference-profile/*",
        "arn:aws:bedrock:*:*:application-inference-profile/*",
        "arn:aws:bedrock:*:*:foundation-model/*"
      ]
    },
    {
      "Sid": "AllowMarketplaceSubscription",
      "Effect": "Allow",
      "Action": [
        "aws-marketplace:ViewSubscriptions",
        "aws-marketplace:Subscribe"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:CalledViaLast": "bedrock.amazonaws.com"
        }
      }
    }
  ]
}
```

Attach this policy to your IAM user or role.

---

### Step 5: Configure Environment Variables

You have **two places** to set these on Windows:

#### Option 1: Via `%USERPROFILE%\.claude\settings.json` (Recommended — Claude Code specific)

This keeps credentials scoped to Claude Code only. Edit your existing settings file:

```json
{
  "model": "opus[1m]",
  "statusLine": {
    "type": "command",
    "command": "powershell -File C:\\Users\\Neha\\.claude\\statusline-script.ps1"
  },
  "alwaysThinkingEnabled": false,
  "skipDangerousModePermissionPrompt": true,
  "env": {
    "CLAUDE_CODE_USE_BEDROCK": "1",
    "AWS_REGION": "us-east-1",
    "AWS_ACCESS_KEY_ID": "YOUR_ACCESS_KEY_HERE",
    "AWS_SECRET_ACCESS_KEY": "YOUR_SECRET_KEY_HERE"
  }
}
```

> [!WARNING]
> Replace `YOUR_ACCESS_KEY_HERE` and `YOUR_SECRET_KEY_HERE` with your actual AWS credentials from Step 2.

> [!TIP]
> Using the `env` block in `settings.json` is better because:
> - Credentials don't leak to other processes
> - They're scoped only to Claude Code
> - They persist across terminal sessions automatically

#### Option 2: Via Environment Variables (System-wide)

If you prefer environment variables available everywhere, you can set them using PowerShell:

```powershell
# Run these in PowerShell to set User environment variables
setx CLAUDE_CODE_USE_BEDROCK "1"
setx AWS_REGION "us-east-1"
setx AWS_ACCESS_KEY_ID "YOUR_ACCESS_KEY_HERE"
setx AWS_SECRET_ACCESS_KEY "YOUR_SECRET_KEY_HERE"

# Optional: Pin model versions
setx ANTHROPIC_DEFAULT_SONNET_MODEL "us.anthropic.claude-sonnet-4-6"
setx ANTHROPIC_DEFAULT_OPUS_MODEL "us.anthropic.claude-opus-4-6-v1"
setx ANTHROPIC_DEFAULT_HAIKU_MODEL "us.anthropic.claude-haiku-4-5-20251001-v1:0"
```

After running `setx`, you will need to restart your PowerShell window for the changes to take effect.

> [!CAUTION]
> Setting variables globally exposes them to ALL processes. Prefer `settings.json` for security.

---

### Step 6: Verify the Setup

```powershell
# 1. Check AWS credentials are working
aws sts get-caller-identity

# 2. Check Bedrock model access in your region
aws bedrock list-inference-profiles --region us-east-1

# 3. Launch Claude Code
claude

# 4. Inside Claude Code, run:
#    /status
#    → Should show provider: "Amazon Bedrock"
```

---

## Quick Summary: The Minimum You Need

For the absolute minimum setup, you need exactly **4 values**:

| What | Where to get it | Where to put it |
|:-----|:----------------|:----------------|
| `CLAUDE_CODE_USE_BEDROCK=1` | Static value | `%USERPROFILE%\.claude\settings.json` → `env` block |
| `AWS_REGION` | Choose: `us-east-1`, `us-west-2`, etc. | `%USERPROFILE%\.claude\settings.json` → `env` block |
| `AWS_ACCESS_KEY_ID` | AWS Console → IAM → Your user → Security credentials | `%USERPROFILE%\.claude\settings.json` → `env` block |
| `AWS_SECRET_ACCESS_KEY` | AWS Console → IAM → Your user → Security credentials | `%USERPROFILE%\.claude\settings.json` → `env` block |

---

## Alternative: Use the Login Wizard (Easiest)

Instead of manual setup, after installing AWS CLI and configuring credentials, you can:

1. Run `claude` in your terminal
2. At the login prompt, select **3rd-party platform**
3. Select **Amazon Bedrock**
4. Follow the wizard — it auto-detects your AWS profiles, verifies model access, and saves everything to `settings.json` for you

After initial setup, run `/setup-bedrock` inside Claude Code anytime to reconfigure.

---

## What Your Final `%USERPROFILE%\.claude\settings.json` Should Look Like

```json
{
  "model": "opus[1m]",
  "statusLine": {
    "type": "command",
    "command": "powershell -File C:\\Users\\Neha\\.claude\\statusline-script.ps1"
  },
  "alwaysThinkingEnabled": false,
  "skipDangerousModePermissionPrompt": true,
  "env": {
    "CLAUDE_CODE_USE_BEDROCK": "1",
    "AWS_REGION": "us-east-1",
    "AWS_ACCESS_KEY_ID": "AKIA...",
    "AWS_SECRET_ACCESS_KEY": "wJalr...",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "us.anthropic.claude-opus-4-6-v1",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "us.anthropic.claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "us.anthropic.claude-haiku-4-5-20251001-v1:0"
  }
}
```

> [!NOTE]
> Since your current settings already have `"model": "opus[1m]"`, that will work with the Bedrock cross-region inference profile once `ANTHROPIC_DEFAULT_OPUS_MODEL` is set.
