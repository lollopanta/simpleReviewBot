# Discord Review Bot

A comprehensive Discord bot built with Discord.js v14 that implements an advanced review system with staff approval and MongoDB persistence.

## Prerequisites

- Node.js 16.9.0 or higher
- MongoDB database (local or MongoDB Atlas)
- Discord Bot Token and Application ID
- Discord server with appropriate channels and roles

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lollopantaBot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in all required values:
   - `BOT_TOKEN`: Your Discord bot token
   - `CLIENT_ID`: Your Discord application/client ID
   - `MONGODB_URI`: Your MongoDB connection string
   - Channel IDs: Staff review channel, reviews channel, logs channel
   - Role IDs: Staff role ID

4. **Set up Discord channels and roles**
   - Create a staff-only channel for review requests
   - Create a public channel for approved reviews
   - Create a logs channel for staff actions
   - Create a staff role and assign it to moderators

5. **Start the bot**
   ```bash
   npm start
   ```

## Commands

### User Commands

- `/request-review` - Request permission to submit a review
- `/view-reviews [user]` - View reviews for a user (defaults to yourself)

### Staff Commands

- `/edit-review <review-id>` - Edit an existing review
- `/delete-review <review-id>` - Delete a review

## Workflow

1. **User requests review**: User runs `/request-review`
2. **Staff approval**: Staff sees request in staff channel and can approve/deny
3. **User submits review**: If approved, user receives DM with button to submit review
4. **Review posted**: Submitted review appears in reviews channel
5. **Management**: Staff can edit or delete reviews as needed

## Project Structure

```
lollopantaBot/
├── commands/          # Slash command handlers
│   ├── request-review.js
│   ├── view-reviews.js
│   ├── edit-review.js
│   └── delete-review.js
├── events/            # Discord event handlers
│   ├── interactionCreate.js
│   └── ready.js
├── models/            # Mongoose database models
│   ├── Review.js
│   ├── ReviewRequest.js
│   └── UserCooldown.js
├── utils/             # Utility functions
│   ├── embeds.js
│   ├── permissions.js
│   ├── cooldown.js
│   └── logger.js
├── config/            # Configuration files
│   └── config.js
├── index.js           # Main bot file
├── .env.example       # Environment variables template
└── package.json       # Dependencies and scripts
```

## Database Schema

### Review
- User ID, username, review text, rating (1-5)
- Timestamp, staff approver ID, status
- Message ID, channel ID, anonymous flag
- Last edited by/at (for edit tracking)

### ReviewRequest
- User ID, username, request message ID
- Status (pending/approved/denied)
- Staff member ID, processed timestamp
- Denial reason (if denied)

### UserCooldown
- User ID, last review request timestamp
- Last review submission timestamp

## Configuration

All configuration is done through environment variables in `.env`:

- **Cooldowns**: Adjust `REVIEW_REQUEST_COOLDOWN` and `REVIEW_SUBMISSION_COOLDOWN`
- **Features**: Toggle anonymous reviews and cooldown system
- **Channels/Roles**: Set channel and role IDs for your server

## Security Features

- Permission checks for all staff commands
- Cooldown system to prevent spam
- One active review request per user at a time
- Input validation for all user inputs
- Error handling and logging

## Troubleshooting

**Bot doesn't respond to commands:**
- Ensure bot token is correct
- Check that bot has necessary permissions in server
- Verify commands are registered (check console on startup)

**MongoDB connection errors:**
- Verify MongoDB URI is correct
- Ensure MongoDB server is running
- Check network connectivity if using MongoDB Atlas

**Permission errors:**
- Verify staff role ID is correct
- Ensure bot has permission to send messages in all channels
- Check that staff members have the configured staff role

## License

ISC

## Support

For issues or questions, please open an issue on the repository.
