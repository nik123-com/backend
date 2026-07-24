const WishList = require('./WishListModel');
const User = require('../user/userModel');
const mongoose = require('mongoose');

module.exports = {
    createWishlist,
    deleteWishList,
    addFriend,
    removeFriend,
    sendMessage,
    addItem,
    removeItem,
    getSingle,
    getAll,
    toggleWishlistAccess
};

async function createWishlist(req, res, next) {
    createWishlistFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function createWishlistFun(req, next) {
    return new Promise(async (resolve, reject) => {
        console.log("hlo");
        
        try {
            const formData = req.body;

            if (!formData.name) {
                return reject({
                    status: 400,
                    success: false,
                    message: "WishList Name is Required"
                });
            }
            console.log(req.decoded);

            const existing = await WishList.findOne({
                listName: formData.name.toLowerCase(),
                addedById: req.decoded.addedById
            });

            if (existing) {
                return reject({
                    status: 400,
                    success: false,
                    message: "Wish Name is Already Exist"
                });
            }

            

            let wishList = new WishList();
            wishList.listName = formData.name.toLowerCase();
            wishList.addedById = req.decoded.addedById;
            wishList.isPublic = formData.public ?? 0;

            const saveData = await wishList.save();

            resolve({
                status: 200,
                success: true,
                message: "Wish List is Created",
                data: saveData
            });

        } catch (err) {
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });
}

async function deleteWishList(req, res, next) {
    deleteWishListFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function deleteWishListFun(req, next) {
    return new Promise(async (resolve, reject) => {
        try {
            const formData = req.body;

            if (!formData._id) {
                return reject({
                    status: 400,
                    success: false,
                    message: "_id is Required"
                });
            }

            const wishlist = await WishList.findById(formData._id);
            if (!wishlist) {
                return reject({
                    status: 404,
                    success: false,
                    message: "Wishlist not found"
                });
            }

            const currentUserId = (req.decoded.addedById || req.decoded.userId).toString();
            const ownerId = (wishlist.addedById?._id || wishlist.addedById).toString();

            if (currentUserId !== ownerId) {
                return reject({
                    status: 403,
                    success: false,
                    message: "Only the author (owner) of this wishlist has authority to delete it"
                });
            }

            await WishList.deleteOne({ _id: formData._id });

            resolve({
                status: 200,
                success: true,
                message: "Delete Successfully"
            });

        } catch (err) {
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });
}

async function addFriend(req, res, next) {
    addFriendFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function addFriendFun(req, next) {
    return new Promise(async (resolve, reject) => {
        try {
            const formData = req.body;

            if (!formData._id) {
                return reject({
                    status: 400,
                    success: false,
                    message: "_id is Required"
                });
            }

            if (!formData.email) {
                return reject({
                    status: 400,
                    success: false,
                    message: "Friend email is Required"
                });
            }

            const groupData = await WishList.findOne({ _id: formData._id });
            if (!groupData) {
                return reject({
                    status: 400,
                    success: false,
                    message: "Wishlist not found"
                });
            }

            const targetUser = await User.findOne({ email: formData.email.toLowerCase().trim() });

            if (!targetUser || targetUser.usertype != "2") {
                return reject({
                    status: 400,
                    success: false,
                    message: "User with this email does not exist"
                });
            }

            const currentUserId = req.decoded.addedById || req.decoded.userId;

            if (groupData.addedById.toString() === targetUser._id.toString()) {
                return reject({
                    status: 400,
                    success: false,
                    message: "Owner cannot invite themselves"
                });
            }

            const existingMember = groupData.sharedWith.find(
                friend => friend.userId && friend.userId.toString() === targetUser._id.toString()
            );

            if (existingMember && existingMember.status === 'accepted') {
                return reject({
                    status: 400,
                    success: false,
                    message: "User is already a member of this wishlist"
                });
            }

            const Notification = require('../notification/NotificationModel');
            const existingPending = await Notification.findOne({
                senderId: currentUserId,
                recipientId: targetUser._id,
                wishlistId: groupData._id,
                status: 'pending'
            });

            if (existingPending) {
                return reject({
                    status: 400,
                    success: false,
                    message: "Invitation is already sent and pending"
                });
            }

            const senderUser = await User.findById(currentUserId);

            const newNotification = new Notification({
                senderId: currentUserId,
                recipientId: targetUser._id,
                wishlistId: groupData._id,
                type: 'wishlist_invite',
                status: 'pending',
                message: `${senderUser?.name || senderUser?.email || 'A user'} invited you to join wishlist "${groupData.listName || 'Collection'}"`
            });
            await newNotification.save();

            if (!existingMember) {
                groupData.sharedWith.push({ userId: targetUser._id, status: 'pending' });
                await groupData.save();
            }

            resolve({
                status: 200,
                success: true,
                message: `Invitation sent to ${targetUser.email}. Waiting for response.`
            });

        } catch (err) {
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });
}

async function removeFriend(req, res, next) {
    removeFriendFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function removeFriendFun(req, next) {
    return new Promise(async (resolve, reject) => {
        try {
            const formData = req.body;

            if (!formData._id) {
                return reject({
                    status: 400,
                    success: false,
                    message: "_id is Required"
                });
            }

            if (!formData.email) {
                return reject({
                    status: 400,
                    success: false,
                    message: "friend email is Required"
                });
            }

            const data = await WishList.findOne({ _id: formData._id });
            const user = await User.findOne({ email: formData.email.toLowerCase() });

            if (!user) {
                return reject({
                    status: 400,
                    success: false,
                    message: "email/user is not exist"
                });
            }

            data.sharedWith = data.sharedWith.filter((itr) => {
                const userId = new mongoose.Types.ObjectId(user._id);
                const memberId = new mongoose.Types.ObjectId(itr.userId);
                return !userId.equals(memberId);
            });

            await data.save();

            resolve({
                status: 200,
                success: true,
                message: "Friend Removed Successfully"
            });

        } catch (err) {
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });
}

async function sendMessage(req, res, next) {
    sendMessageFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function sendMessageFun(req, next) {
    return new Promise(async (resolve, reject) => {
        try {
            const formData = req.body;

            if (!formData._id) {
                return reject({
                    status: 400,
                    success: false,
                    message: "_id is Required"
                });
            }

            if (!formData.content) {
                return reject({
                    status: 400,
                    success: false,
                    message: "message is Required"
                });
            }

            const data = await WishList.findOne({ _id: formData._id });

            let obj = {
                sender: req.decoded.addedById,
                content: formData.content
            };

            if (formData.type) obj.type = formData.type;

            data.messages.push(obj);

            const saveData = await data.save();

            resolve({
                status: 200,
                success: true,
                message: "Message Added Successfully",
                data: saveData
            });

        } catch (err) {
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });
}

async function addItem(req, res, next) {
    addItemFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function addItemFun(req, next) {
    return new Promise(async (resolve, reject) => {
        try {
            const formData = req.body;

            if (!formData._id) {
                return reject({
                    status: 400,
                    success: false,
                    message: "_id is Required"
                });
            }

            if (!formData.productId) {
                return reject({
                    status: 400,
                    success: false,
                    message: "productId is Required"
                });
            }

            const data = await WishList.findOne({ _id: formData._id });

            data.items.push({ productId: formData.productId });

            const saveData = await data.save();

            resolve({
                status: 200,
                success: true,
                message: "Item Added Successfully",
                data: saveData
            });

        } catch (err) {
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });
}

async function removeItem(req, res, next) {
    removeItemFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function removeItemFun(req, next) {
    return new Promise(async (resolve, reject) => {
        try {
            const formData = req.body;

            if (!formData._id) {
                return reject({
                    status: 400,
                    success: false,
                    message: "_id is Required"
                });
            }

            if (!formData.productId) {
                return reject({
                    status: 400,
                    success: false,
                    message: "productId is Required"
                });
            }

            const data = await WishList.findOne({ _id: formData._id });

            data.items = data.items.filter((itr) => {
                const productId = new mongoose.Types.ObjectId(formData.productId);
                const itrProductId = new mongoose.Types.ObjectId(itr.productId);
                return !productId.equals(itrProductId);
            });

            const saveData = await data.save();

            resolve({
                status: 200,
                success: true,
                message: "Item Removed Successfully",
                data: saveData
            });

        } catch (err) {
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });
}

async function getSingle(req, res, next) {
    getSingleFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function getSingleFun(req, next) {
    return new Promise(async (resolve, reject) => {
        try {
            const formData = req.body;

            if (!formData._id) {
                return reject({
                    status: 400,
                    success: false,
                    message: "wishList id is Required"
                });
            }

            const data = await WishList.findOne({ _id: formData._id })
                .populate('items.productId')
                .populate('sharedWith.userId')
                .populate('messages.sender');

            if (!data) {
                return reject({
                    status: 400,
                    success: false,
                    message: "wishList is not exist"
                });
            }

            resolve({
                status: 200,
                success: true,
                message: "wishedList fetched successfully",
                data: data
            });

        } catch (err) {
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });
}

async function getAll(req, res, next) {
    getAllFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function getAllFun(req, next) {
    return new Promise(async (resolve, reject) => {
        try {
            const formData = req.body;
            let data = [];

            console.log("Fetching wishlists for user:", req.decoded.addedById);
            if (formData.public) {
                data = await WishList.find({
                    $and: [
                        { isPublic: 1 },
                        {
                            sharedWith: {
                                $not: {
                                    $elemMatch: {
                                        userId: new mongoose.Types.ObjectId(req.decoded.addedById)
                                    }
                                }
                            }
                        },
                        { addedById: { $ne: new mongoose.Types.ObjectId(req.decoded.addedById) } }
                    ]
                })
                    .populate("addedById")
                    .populate("items.productId")
                    .populate("sharedWith.userId")
                    .populate("messages.sender");
            } 
            else {
                const currentUserId = new mongoose.Types.ObjectId(req.decoded.addedById || req.decoded.userId);
                data = await WishList.find({
                    $or: [
                        { addedById: currentUserId },
                        { 
                            sharedWith: {
                                $elemMatch: {
                                    userId: currentUserId,
                                    status: { $ne: 'pending' }
                                }
                            } 
                        }
                    ]
                })
                    .populate("items.productId")
                    .populate("addedById")
                    .populate("sharedWith.userId")
                    .populate("messages.sender");
            }
            console.log("Found wishlists count:", data.length);

            resolve({
                status: 200,
                success: true,
                message: "WishList fetched successfully",
                data: data
            });

        } catch (err) {
            console.log(err);
            
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });
}

async function toggleWishlistAccess(req, res, next) {
    toggleWishlistAccessFun(req)
        .then(result => res.status(result.status || 200).json(result))
        .catch(err => res.status(err.status || 500).json(err));
}

function toggleWishlistAccessFun(req, next) {
    return new Promise(async (resolve, reject) => {
        try {
            const formData = req.body;

            if (!formData._id) {
                return reject({
                    status: 400,
                    success: false,
                    message: "wishlist ID is required"
                });
            }

            if (formData.public === null || formData.public === undefined) {
                return reject({
                    status: 400,
                    success: false,
                    message: "public key is missing"
                });
            }

            const result = await WishList.findOne({ _id: formData._id });

            if (!result) {
                return reject({
                    status: 400,
                    success: false,
                    message: "WishList is not exist"
                });
            }

            const currentUserId = (req.decoded.addedById || req.decoded.userId).toString();
            const ownerId = (result.addedById?._id || result.addedById).toString();

            if (currentUserId !== ownerId) {
                return reject({
                    status: 403,
                    success: false,
                    message: "Only the author (owner) of this wishlist can change privacy settings"
                });
            }

            result.isPublic = formData.public;

            const saveRes = await result.save();

            resolve({
                status: 200,
                success: true,
                message: "access updated successfully",
                data: saveRes
            });

        } catch (err) {
            reject({
                status: 500,
                success: false,
                message: err.message || err
            });
        }
    });

}