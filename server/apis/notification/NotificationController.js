const Notification = require('./NotificationModel');
const WishList = require('../wishList/WishListModel');
const User = require('../user/userModel');

module.exports = {
    getNotifications,
    respondInvite,
    markAsRead
};

async function getNotifications(req, res) {
    try {
        const userId = req.decoded.userId || req.decoded.addedById;
        const notifications = await Notification.find({ recipientId: userId })
            .sort({ createdAt: -1 })
            .populate('senderId', 'name email')
            .populate('wishlistId', 'listName');

        res.status(200).json({
            success: true,
            status: 200,
            data: notifications
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            status: 500,
            message: err.message || "Error fetching notifications"
        });
    }
}

async function respondInvite(req, res) {
    try {
        const { notificationId, action } = req.body;
        const userId = req.decoded.userId || req.decoded.addedById;

        if (!notificationId || !action || !['accept', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "notificationId and valid action ('accept' or 'reject') are required"
            });
        }

        const notification = await Notification.findOne({ _id: notificationId, recipientId: userId });
        if (!notification) {
            return res.status(404).json({
                success: false,
                status: 404,
                message: "Notification not found"
            });
        }

        if (notification.status !== 'pending') {
            return res.status(400).json({
                success: false,
                status: 400,
                message: `Invite has already been ${notification.status}`
            });
        }

        const recipientUser = await User.findById(userId);
        const wishlist = await WishList.findById(notification.wishlistId);

        if (action === 'accept') {
            notification.status = 'accepted';
            await notification.save();

            if (wishlist) {
                const existingIndex = wishlist.sharedWith.findIndex(
                    f => f.userId.toString() === userId.toString()
                );
                if (existingIndex > -1) {
                    wishlist.sharedWith[existingIndex].status = 'accepted';
                } else {
                    wishlist.sharedWith.push({ userId, status: 'accepted' });
                }
                await wishlist.save();

                // Send notification back to wishlist owner / sender
                const replyNotification = new Notification({
                    senderId: userId,
                    recipientId: notification.senderId,
                    wishlistId: wishlist._id,
                    type: 'invite_accepted',
                    status: 'pending',
                    message: `${recipientUser?.name || recipientUser?.email || 'A user'} accepted your invitation to join wishlist "${wishlist.listName || 'Collection'}"!`
                });
                await replyNotification.save();
            }

            return res.status(200).json({
                success: true,
                status: 200,
                message: "Wishlist invitation accepted successfully!"
            });
        } else {
            notification.status = 'rejected';
            await notification.save();

            if (wishlist) {
                wishlist.sharedWith = wishlist.sharedWith.filter(
                    f => f.userId.toString() !== userId.toString()
                );
                await wishlist.save();

                // Send notification back to wishlist owner / sender
                const replyNotification = new Notification({
                    senderId: userId,
                    recipientId: notification.senderId,
                    wishlistId: wishlist._id,
                    type: 'invite_rejected',
                    status: 'pending',
                    message: `${recipientUser?.name || recipientUser?.email || 'A user'} declined your invitation to join wishlist "${wishlist.listName || 'Collection'}".`
                });
                await replyNotification.save();
            }

            return res.status(200).json({
                success: true,
                status: 200,
                message: "Wishlist invitation declined."
            });
        }
    } catch (err) {
        console.error("respondInvite error:", err);
        res.status(500).json({
            success: false,
            status: 500,
            message: err.message || "Failed to respond to invite"
        });
    }
}

async function markAsRead(req, res) {
    try {
        const userId = req.decoded.userId || req.decoded.addedById;
        await Notification.updateMany(
            { recipientId: userId, status: 'pending', type: { $ne: 'wishlist_invite' } },
            { $set: { status: 'read' } }
        );
        res.status(200).json({
            success: true,
            status: 200,
            message: "Notifications marked as read"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            status: 500,
            message: err.message || "Failed to mark notifications as read"
        });
    }
}
