const mongoose = require('mongoose');

/**
 * Staff Action Log Schema
 * Tracks all staff actions for statistics and auditing
 */
const staffActionLogSchema = new mongoose.Schema({
    // Discord Guild ID
    guildId: {
        type: String,
        required: true,
        index: true
    },
    
    // Staff member who performed the action
    staffMemberId: {
        type: String,
        required: true,
        index: true
    },
    
    // Staff member username (for historical reference)
    staffMemberUsername: {
        type: String,
        required: true
    },
    
    // Action type
    actionType: {
        type: String,
        required: true,
        enum: ['approve', 'deny', 'edit', 'delete', 'product_create', 'product_edit', 'product_delete'],
        index: true
    },
    
    // Target type (what was acted upon)
    targetType: {
        type: String,
        enum: ['review', 'review_request', 'product', null],
        default: null
    },
    
    // Target ID (review ID, request ID, product ID, etc.)
    targetId: {
        type: String,
        default: null
    },
    
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Processing time in milliseconds (for approval/denial)
    processingTime: {
        type: Number,
        default: null
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
staffActionLogSchema.index({ guildId: 1, createdAt: -1 });
staffActionLogSchema.index({ guildId: 1, actionType: 1, createdAt: -1 });
staffActionLogSchema.index({ staffMemberId: 1, createdAt: -1 });

/**
 * Static method to get staff statistics
 */
staffActionLogSchema.statics.getStaffStats = async function(guildId, staffMemberId = null, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const match = {
        guildId,
        createdAt: { $gte: startDate }
    };
    
    if (staffMemberId) {
        match.staffMemberId = staffMemberId;
    }
    
    const stats = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$staffMemberId',
                totalActions: { $sum: 1 },
                approvals: {
                    $sum: { $cond: [{ $eq: ['$actionType', 'approve'] }, 1, 0] }
                },
                denials: {
                    $sum: { $cond: [{ $eq: ['$actionType', 'deny'] }, 1, 0] }
                },
                edits: {
                    $sum: { $cond: [{ $eq: ['$actionType', 'edit'] }, 1, 0] }
                },
                deletes: {
                    $sum: { $cond: [{ $eq: ['$actionType', 'delete'] }, 1, 0] }
                },
                avgProcessingTime: {
                    $avg: {
                        $cond: [
                            { $ne: ['$processingTime', null] },
                            '$processingTime',
                            null
                        ]
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'staffactionlogs',
                let: { staffId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$staffMemberId', '$$staffId'] },
                                    { $eq: ['$actionType', 'approve'] },
                                    { $ne: ['$processingTime', null] }
                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            avgTime: { $avg: '$processingTime' }
                        }
                    }
                ],
                as: 'approvalTimes'
            }
        }
    ]);
    
    return stats;
};

module.exports = mongoose.model('StaffActionLog', staffActionLogSchema);
