# Twilio SMS Setup Guide

**Date:** October 21, 2025  
**Purpose:** Enable SMS invites for aiMessage

---

## 🎯 **What You'll Get**

Users can tap "Invite" on non-app contacts and send them an SMS:

```
"Hey! Join me on aiMessage to chat: https://aimessage.app/invite/abc123"
```

---

## 📱 **Step 1: Create Twilio Account**

### Sign Up
1. Go to: https://www.twilio.com/try-twilio
2. Sign up (free trial gives $15 credit = ~1,900 SMS)
3. Verify your email and phone number

### Get Credentials
After signup, you'll see:
```
Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Auth Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Save these!** You'll need them for the Cloud Function.

---

## 📞 **Step 2: Get a Phone Number**

### Purchase Number
1. In Twilio Console: Phone Numbers → Manage → Buy a number
2. **Free trial:** You get one free number
3. **Production:** $1/month per number
4. Choose a US number with SMS capability
5. Buy it!

Your number: `+1 (XXX) XXX-XXXX`

---

## 💰 **Step 3: Understand Pricing**

### Free Trial
- **$15 credit** (good for ~1,900 SMS)
- Can only send to **verified numbers** (add in console)
- Perfect for development/testing

### Production (Upgrade Required)
- **$0.0079 per SMS** (US)
- No restrictions on recipients
- **Example:** 1,000 invites/month = $7.90

### Monthly Costs
- Phone number: $1/month
- SMS usage: $0.0079 per message
- **Total for 500 invites/month:** ~$5

---

## 🔧 **Step 4: Add Twilio to Cloud Functions**

### Install Twilio SDK

```bash
cd functions
npm install twilio
```

### Add Environment Variables

```bash
# In your project root
firebase functions:config:set \
  twilio.account_sid="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  twilio.auth_token="your-auth-token-here" \
  twilio.phone_number="+15551234567"
```

Verify it worked:
```bash
firebase functions:config:get
```

---

## 🧪 **Step 5: Testing Strategy**

### Development (Free Trial)
1. Add your personal phone as verified number in Twilio
2. Test invites to yourself
3. See SMS arrive immediately
4. Verify link works

### Production
1. Upgrade Twilio account (add credit card)
2. Remove verified number restrictions
3. Send real invites to friends
4. Monitor usage in Twilio dashboard

---

## 📊 **Cost Estimation**

### Scenario 1: Small App (100 users)
- 100 users each invite 5 friends = 500 invites
- Cost: $5/month (phone + SMS)

### Scenario 2: Medium App (1,000 users)  
- 1,000 users each invite 5 friends = 5,000 invites
- Cost: $41/month (phone + SMS)

### Scenario 3: Large App (10,000 users)
- 10,000 users each invite 5 friends = 50,000 invites  
- Cost: $396/month (phone + SMS)

**Note:** Most users won't invite 5 friends. Real conversion ~2-3 invites per user.

---

## 🚀 **Quick Start Commands**

### Create Twilio Account
```
1. Go to: https://www.twilio.com/try-twilio
2. Sign up
3. Get free $15 credit
```

### Get Credentials  
```
Dashboard → Account Info
- Copy Account SID
- Copy Auth Token  
- Buy phone number
```

### Configure Firebase
```bash
firebase functions:config:set \
  twilio.account_sid="YOUR_ACCOUNT_SID" \
  twilio.auth_token="YOUR_AUTH_TOKEN" \
  twilio.phone_number="YOUR_TWILIO_NUMBER"
```

### Deploy
```bash
cd functions
npm install twilio
cd ..
firebase deploy --only functions
```

---

## ✅ **What to Do Now**

### Option 1: Set Up Now (Recommended)
1. Create Twilio account (5 minutes)
2. Get free trial credits  
3. Configure Firebase Functions
4. Test invites immediately

### Option 2: Skip for Now
- Invite feature code will be ready
- Button will be there but disabled
- Can enable anytime by adding Twilio

**I'll implement the code regardless - you can set up Twilio whenever you're ready!**

---

## 🔗 **Useful Links**

- Twilio Console: https://console.twilio.com
- Twilio Pricing: https://www.twilio.com/sms/pricing/us
- Free Trial Info: https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account
- Node.js SDK: https://www.twilio.com/docs/libraries/node

---

**Ready to implement the invite feature code now!** 🎉

