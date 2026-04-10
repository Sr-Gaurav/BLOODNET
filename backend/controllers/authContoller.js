
import bcrypt from "bcryptjs";
import Donor from "../models/donorModel.js";
import Facility from "../models/facilityModel.js";
import Admin from "../models/adminModel.js";
import jwt from "jsonwebtoken";

/**
 * REGISTER (Unified)
 */
export const register = async (req, res) => {
  try {
    // 🔥 DEBUG: Check incoming data
    console.log("📩 REQ BODY:", req.body);

    const { role, email } = req.body;

    // ✅ Basic validation
    if (!role) {
      return res.status(400).json({ message: "Role is required" });
    }

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // ✅ Check duplicate user
    const existingUser =
      (await Donor.findOne({ email })) ||
      (await Facility.findOne({ email }));

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    let user;

    if (role === "donor") {
      user = await Donor.create(req.body);
    } else if (role === "hospital" || role === "blood-lab") {
      user = await Facility.create(req.body);
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    const redirect =
      role === "donor" ? "/donor/dashboard" : "/";

    res.status(201).json({
      success: true,
      message:
        role === "donor"
          ? "Donor registered successfully! Redirecting to dashboard..."
          : "Facility registered successfully! Please wait for admin approval.",
      user: { id: user._id, email: user.email, role: user.role },
      redirect,
    });

  } catch (error) {
    // 🔥 FULL ERROR LOG
    console.error("❌ FULL REGISTRATION ERROR:", error);

    res.status(400).json({
      message: "Registration failed",
      error: error.message,
      details: error.errors || null, // shows validation issues clearly
    });
  }
};

/**
 * LOGIN (Unified)
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    // 🔍 Find user
    let user =
      (await Donor.findOne({ email }).select("+password")) ||
      (await Admin.findOne({ email }).select("+password")) ||
      (await Facility.findOne({ email }).select("+password"));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔐 Password check
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 🚫 Facility approval check
    if (user instanceof Facility) {
      if (user.status === "pending") {
        return res.status(403).json({
          success: false,
          message: "Your account is awaiting admin approval."
        });
      }

      if (user.status === "rejected") {
        return res.status(403).json({
          success: false,
          message: "Your registration has been rejected."
        });
      }
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 📊 Update login info
    user.lastLogin = new Date();

    if (user instanceof Facility) {
      user.history.push({
        eventType: "Login",
        description: "Facility logged in",
        date: new Date(),
      });

      if (user.history.length > 50) {
        user.history = user.history.slice(-50);
      }
    }

    await user.save();

    // 🎯 Redirect logic
    let redirect = "/";
    if (user.role === "donor") redirect = "/donor";
    else if (user.role === "hospital") redirect = "/hospital";
    else if (user.role === "blood-lab") redirect = "/lab";
    else if (user.role === "admin") redirect = "/admin";

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status
      },
      redirect,
    });

  } catch (error) {
    console.error("🚨 LOGIN ERROR:", error);

    res.status(500).json({
      message: "Login failed",
      error: error.message
    });
  }
};

/**
 * PROFILE FETCH
 */
export const getProfile = async (req, res) => {
  try {
    let user;

    if (req.user.role === "donor") {
      user = await Donor.findById(req.user.id).select("-password");
    } else if (req.user.role === "admin") {
      user = await Admin.findById(req.user.id).select("-password");
    } else {
      user = await Facility.findById(req.user.id).select("-password");
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });

  } catch (error) {
    console.error("🚨 PROFILE ERROR:", error);

    res.status(500).json({
      message: "Error fetching profile",
      error: error.message
    });
  }
};
