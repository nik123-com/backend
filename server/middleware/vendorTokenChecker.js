const jwt = require("jsonwebtoken");
const skey = "SecreteKey";
const VendorModel = require("../apis/vendor/VendorModel");
const userModel = require("../apis/user/userModel");

module.exports = async (req, res, next) => {
    let token = req.headers["authorization"];
    if (!token) {
        return res.status(401).json({
            message: "Authorization token required",
            status: 401,
            success: false
        });
    }

    jwt.verify(token, skey, async function (err, decoded) {
        if (err) {
            return res.status(401).json({
                message: "Token invalid or expired. Please log in again.",
                status: 401,
                success: false,
                err: err
            });
        }

        if (decoded.userType !== "3") {
            return res.status(403).json({
                message: "Access denied. Vendor account required.",
                status: 403,
                success: false
            });
        }

        try {
            const user = await userModel.findById(decoded.userId);
            if (!user || user.isBlocked === true) {
                return res.status(403).json({
                    message: "User account is blocked or invalid.",
                    status: 403,
                    success: false
                });
            }

            const vendor = await VendorModel.findOne({ userId: decoded.userId });
            if (!vendor) {
                return res.status(404).json({
                    message: "Vendor profile not found.",
                    status: 404,
                    success: false
                });
            }

            if (vendor.status !== "Approved") {
                return res.status(403).json({
                    message: `Vendor account is ${vendor.status.toLowerCase()}. Admin approval required before login.`,
                    status: 403,
                    success: false,
                    vendorStatus: vendor.status
                });
            }

            if (vendor.isBlocked) {
                return res.status(403).json({
                    message: "Vendor store is currently blocked by Admin.",
                    status: 403,
                    success: false
                });
            }

            req.decoded = decoded;
            req.vendor = vendor;
            next();
        } catch (dbErr) {
            console.error("vendorTokenChecker error:", dbErr);
            return res.status(500).json({
                message: "Authentication server error",
                status: 500,
                success: false
            });
        }
    });
};
