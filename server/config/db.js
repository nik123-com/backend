const mongoose = require('mongoose');
const dns = require('dns');

// Set public DNS servers to resolve MongoDB Atlas SRV lookup issues
try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
    console.log("DNS setServers failed:", e);
}

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.db)
        console.log("DB Connected")

        // Synchronize product ratings with customer reviews
        const ProductModel = require('../apis/product/ProductModel');
        const reviewModel = require('../apis/review/ReviewModel');
        const products = await ProductModel.find({});
        for (const product of products) {
            const reviews = await reviewModel.find({ productId: product._id, status: true });
            let avgRating = 0;
            if (reviews.length > 0) {
                const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
                avgRating = totalRating / reviews.length;
            }
            product.rating = avgRating;
            await product.save();
        }
        console.log("Product ratings initialized/synchronized successfully!");
    } catch (err) {
        console.log("Error Connecting DB: ", err);
    }
}

module.exports = connectDb