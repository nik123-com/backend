const mongoose = require("mongoose")
const orderSchema = new mongoose.Schema({
    autoId: { type: Number, default: 0 },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "customer", default: null },
    couponApplied: { type: String, default: "" },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "coupon", default: null },
    products: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
            quantity: { type: Number, default: 1 },
            vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "vendor", default: null },
            itemStatus: { type: String, enum: ['pending', 'accepted', 'packed', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
            price: { type: Number, default: 0 }
        }
    ],
    addressId: { type: mongoose.Schema.Types.ObjectId, ref: "Addresses", default: null },
    grandTotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    trackingURL: { type: String, default: "" },
    paymentMethod: { type: String, default: "Online" },
    paymentStatus: { type: String, default: "" },
    orderStatus: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now() },
    updatedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    addedById: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    updatedById: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null }
})

orderSchema.index({ customerId: 1, isDeleted: 1 });
orderSchema.index({ "products.productId": 1, isDeleted: 1 });
orderSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = new mongoose.model("order", orderSchema)