# AWS EC2 Setup Guide - Step by Step

This guide walks you through launching an EC2 instance for the IoT Elderly Care system.

## Step-by-Step Configuration

### 1. Navigate to EC2 Dashboard

1. Log in to AWS Console: https://console.aws.amazon.com
2. Search for "EC2" in the top search bar
3. Click "EC2" to open the EC2 Dashboard
4. Click **"Launch Instance"** button (orange button)

---

## Instance Configuration Wizard

### Step 1: Name and Tags

**Name**: `iot-elderly-care-server`

- **Purpose**: Helps identify your instance
- **Recommendation**: Use a descriptive name
- **Tags** (optional): You can add tags like `Project: IoT-Care`, `Environment: Production`

---

### Step 2: Application and OS Images (AMI)

**Choose**: **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**

Settings:
- **Architecture**: `64-bit (x86)`
- **AMI**: Look for "Ubuntu Server 22.04 LTS"
- **Free tier eligible**: ✅ (should show "Free tier eligible" label)

**Why Ubuntu?**
- Well-supported for Docker
- Large community
- apt package manager is familiar
- Free tier eligible

---

### Step 3: Instance Type

**Choose**: **t2.micro** (Free tier) or **t3.small** (Better performance)

| Instance Type | vCPUs | Memory | Free Tier | Monthly Cost* | Recommendation |
|---------------|-------|--------|-----------|---------------|----------------|
| **t2.micro** | 1 | 1 GB | ✅ Yes | Free (12 months) then ~$8.50 | For testing |
| **t3.small** | 2 | 2 GB | ❌ No | ~$15/month | For production |

**Recommendation for this project**:
- **Start with t2.micro** for testing
- **Upgrade to t3.small** if you notice performance issues

**Why t3.small is better?**
- More memory for Python server + MQTT
- Better for handling multiple M5Stack connections
- More stable under load

---

### Step 4: Key Pair (Login)

**Option A: Create new key pair** (if you don't have one)

1. Click **"Create new key pair"**
2. Settings:
   - **Key pair name**: `iot-elderly-care-key`
   - **Key pair type**: `RSA`
   - **Private key file format**:
     - Choose `.pem` if using Mac/Linux
     - Choose `.ppk` if using Windows with PuTTY
3. Click **"Create key pair"**
4. **IMPORTANT**: Save the downloaded `.pem` file safely - you can't download it again!

**Option B: Use existing key pair**

If you already have a key pair, select it from the dropdown.

**Security Note**:
- The `.pem` file is like your password - keep it secure
- On Mac/Linux, set permissions: `chmod 400 iot-elderly-care-key.pem`

---

### Step 5: Network Settings

Click **"Edit"** next to Network settings

#### 5a. VPC and Subnet
- **VPC**: Leave as default
- **Subnet**: Leave as "No preference" or choose any available
- **Auto-assign public IP**: **Enable** ✅ (Important!)

#### 5b. Firewall (Security Groups)

**Choose**: **Create security group**

**Security group name**: `iot-elderly-care-sg`
**Description**: `Security group for IoT elderly care system`

**Inbound Security Group Rules** - Click "Add security group rule" to add these:

| Type | Protocol | Port Range | Source Type | Source | Description |
|------|----------|------------|-------------|--------|-------------|
| SSH | TCP | 22 | My IP | (auto-filled) | SSH access from your computer |
| Custom TCP | TCP | 1883 | Anywhere IPv4 | 0.0.0.0/0 | MQTT broker for M5Stack |
| Custom TCP | TCP | 8000 | Anywhere IPv4 | 0.0.0.0/0 | Web Dashboard |

**How to add rules:**

1. **Rule 1 (SSH)** - Should be there by default
   - Type: `SSH`
   - Source: `My IP` (recommended) or `Anywhere` (less secure)

2. **Rule 2 (MQTT)** - Click "Add security group rule"
   - Type: `Custom TCP`
   - Port range: `1883`
   - Source type: `Anywhere IPv4`
   - CIDR: `0.0.0.0/0`
   - Description: `MQTT broker for M5Stack devices`

3. **Rule 3 (Web Dashboard)** - Click "Add security group rule"
   - Type: `Custom TCP`
   - Port range: `8000`
   - Source type: `Anywhere IPv4`
   - CIDR: `0.0.0.0/0`
   - Description: `Web Dashboard`

**Security Warning**:
- Opening ports to `0.0.0.0/0` means anyone can try to connect
- For production, consider:
  - Adding MQTT authentication
  - Using a VPN
  - Restricting source IPs if M5Stacks have static IPs

---

### Step 6: Configure Storage

**Root Volume Settings:**
- **Size (GiB)**: `8` GB minimum, **16 GB recommended**
- **Volume type**: `gp3` (General Purpose SSD) - Best value
- **Delete on termination**: ✅ Keep checked (unless you want to keep data after instance deletion)

**Why 16 GB?**
- Docker images can be large
- Logs accumulate over time
- System updates need space
- Still within free tier limits

---

### Step 7: Advanced Details (Optional)

**Most settings can be left as default**, but here are useful ones:

#### User Data (Optional but Useful)

Scroll down to **"User data"** and paste this script to auto-install Docker on first boot:

```bash
#!/bin/bash
# Auto-install Docker and dependencies
apt update
apt install -y docker.io
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu
```

**Benefit**: Saves you from manually installing Docker later.

**Other settings to leave as default:**
- IAM instance profile: None
- Purchasing option: On-Demand
- Metadata version: V2 only (IMDSv2)

---

### Step 8: Summary and Launch

1. Review the **Summary** panel on the right:
   - Number of instances: `1`
   - Instance type: `t2.micro` or `t3.small`
   - Total cost estimate shown

2. Click **"Launch Instance"** (orange button)

3. You'll see a success message with your instance ID

---

## After Launch: Get Your Instance Details

### 1. View Your Instance

1. Click **"View all instances"** or go to EC2 Dashboard → Instances
2. Wait for **Instance State** to show `Running` (takes 1-2 minutes)
3. Wait for **Status Check** to show `2/2 checks passed`

### 2. Get Public IP Address

1. Select your instance (checkbox)
2. Look at the **Details** tab at the bottom
3. Find **"Public IPv4 address"** - this is what you'll use!

Example: `54.123.45.67`

### 3. Allocate Elastic IP (Recommended)

**Why?** The public IP changes every time you stop/start the instance. Elastic IP is permanent.

**Steps:**
1. Left sidebar → **Network & Security** → **Elastic IPs**
2. Click **"Allocate Elastic IP address"**
3. Click **"Allocate"**
4. Select the new Elastic IP
5. Click **"Actions"** → **"Associate Elastic IP address"**
6. **Instance**: Select your `iot-elderly-care-server`
7. Click **"Associate"**

**Cost Note**: Elastic IPs are FREE while associated with a running instance. $0.005/hour if not associated.

---

## Test SSH Connection

### On Mac/Linux:

```bash
# Set correct permissions for key file
chmod 400 ~/Downloads/iot-elderly-care-key.pem

# Connect to EC2 (replace IP with yours)
ssh -i ~/Downloads/iot-elderly-care-key.pem ubuntu@54.123.45.67
```

### On Windows:

**Option A: Using PowerShell**
```powershell
ssh -i C:\Users\YourName\Downloads\iot-elderly-care-key.pem ubuntu@54.123.45.67
```

**Option B: Using PuTTY**
1. Open PuTTY
2. Host Name: `ubuntu@54.123.45.67`
3. Connection → SSH → Auth → Browse for your `.ppk` key
4. Click Open

### Expected Output:

```
Welcome to Ubuntu 22.04.1 LTS (GNU/Linux 5.15.0-1022-aws x86_64)

 * Documentation:  https://help.ubuntu.com
...
ubuntu@ip-172-31-xx-xx:~$
```

✅ You're connected!

---

## Quick Deployment After EC2 Setup

Once your EC2 instance is running and you can SSH into it:

### From Your Local Machine:

```bash
# Deploy using the automated script
cd /path/to/iot-edge-computing-g8
./deploy-to-ec2.sh <YOUR_ELASTIC_IP> ~/Downloads/iot-elderly-care-key.pem

# Example
./deploy-to-ec2.sh 54.123.45.67 ~/Downloads/iot-elderly-care-key.pem
```

This will:
1. Build Docker image
2. Upload to EC2
3. Install Docker (if not using user data)
4. Run the container
5. Show you the dashboard URL

---

## Troubleshooting

### ❌ "Connection refused" or "Connection timeout"

**Cause**: Security group not configured correctly

**Solution**:
1. EC2 Dashboard → Security Groups
2. Select `iot-elderly-care-sg`
3. **Inbound rules** tab
4. Verify ports 22, 1883, 8000 are open
5. Click "Edit inbound rules" to add missing ones

### ❌ "Permission denied (publickey)"

**Cause**: Wrong key file or permissions

**Solution**:
```bash
# Check file permissions
ls -l iot-elderly-care-key.pem

# Should show: -r-------- or -r--------

# Fix permissions
chmod 400 iot-elderly-care-key.pem

# Try connecting again
ssh -i iot-elderly-care-key.pem ubuntu@<IP>
```

### ❌ "No space left on device"

**Cause**: Storage too small

**Solution**:
1. Stop instance
2. Actions → Instance Settings → Change instance type
3. Increase storage size
4. Start instance

### ⚠️ Instance state stuck at "Pending"

**Solution**: Wait 2-3 minutes. If still pending after 5 minutes, terminate and create new instance.

---

## Cost Management

### Free Tier Limits (First 12 Months)

- **750 hours/month** of t2.micro (enough for 1 instance 24/7)
- **30 GB** of EBS storage
- **15 GB** data transfer out

### After Free Tier

- **t2.micro**: ~$8.50/month
- **t3.small**: ~$15/month
- **Data transfer**: First 100GB free, then $0.09/GB

### Save Money Tips

1. **Stop instance when not using** (testing only)
   - Stops compute charges
   - Still charged for storage (~$0.80/month for 8GB)

2. **Use CloudWatch billing alerts**
   - Set alert at $5, $10, etc.

3. **Terminate when done testing**
   - Completely removes instance
   - Deletes storage (no charges)

---

## Security Best Practices

### After First Login:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Recommended:

1. **Change SSH port** from 22 to custom (reduces bot attacks)
2. **Enable UFW firewall**:
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 1883/tcp
   sudo ufw allow 8000/tcp
   sudo ufw enable
   ```
3. **Monitor logs**: `tail -f /var/log/auth.log`
4. **Set up CloudWatch** for monitoring

---

## Quick Reference Checklist

- [ ] Launch EC2 instance (Ubuntu 22.04, t2.micro/t3.small)
- [ ] Create/select key pair (save .pem file securely)
- [ ] Configure security group (ports 22, 1883, 8000)
- [ ] Allocate Elastic IP
- [ ] Associate Elastic IP with instance
- [ ] Test SSH connection
- [ ] Run deployment script
- [ ] Update firmware MQTT_HOST with Elastic IP
- [ ] Upload firmware to M5Stack devices
- [ ] Test dashboard at http://<ELASTIC_IP>:8000

---

## Next Steps

After EC2 is configured and running:

1. **Deploy Docker container**: See DOCKER_DEPLOYMENT.md
2. **Update firmware**: Change MQTT_HOST in `lib_shared/M5_IoT_Shared/SharedIoT.cpp`
3. **Test M5Stack connection**: Upload firmware and check serial monitor
4. **Access dashboard**: http://<YOUR_ELASTIC_IP>:8000

Good luck! 🚀
