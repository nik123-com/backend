const mongoose = require("mongoose")

const VariantSchema = new mongoose.Schema({
    name: { type: String, default: "" },
    options: { type: [String], default: [] },
    price: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    sku: { type: String, default: "" }
}, { _id: false });

const ProductSchema = new mongoose.Schema({
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    image: { type: [String], default: [] },
    price: { type: String, default: "" },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
    brand_id: { type: mongoose.Schema.Types.ObjectId, ref: "brands" },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "vendor", default: null },
    stock: { type: Number, default: 0 },
    sku: { type: String, default: "" },
    warehouse: { type: String, default: "Main Warehouse" },
    variants: [VariantSchema],
    isDraft: { type: Boolean, default: false },
    seoTitle: { type: String, default: "" },
    seoKeywords: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    status: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    create_at: { type: Date, default: Date.now() }
})

ProductSchema.index({ vendorId: 1 });
ProductSchema.index({ category_id: 1, status: 1 });
ProductSchema.index({ brand_id: 1, status: 1 });
ProductSchema.index({ status: 1, create_at: -1 });

module.exports = mongoose.model("Product", ProductSchema)