require("dotenv").config()
const express = require('express');
const bcrypt = require("bcrypt")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const cors = require('cors');
const nodemailer = require("nodemailer")
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
})

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const User = require("./models/users");
const Chat = require("./models/chat")
const Message = require("./models/message")


const connectToMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB successfully!');
    }
    catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    }

}

connectToMongoDB()


const sendVerificationEmail = async (email, token) => {
    const verificationLink = `${process.env.BASE_URL}/verify?token=${token}`;

    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Verify Your Email",
        // Replace text with HTML
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #4CAF50;">Verify Your Email</h2>
                <p>Hi there,</p>
                <p>Thanks for signing up! Please click the button below to verify your email address:</p>
                <a href="${verificationLink}" 
                   style="
                       display: inline-block;
                       padding: 10px 20px;
                       margin: 10px 0;
                       font-size: 16px;
                       color: white;
                       background-color: #4CAF50;
                       text-decoration: none;
                       border-radius: 5px;
                   ">
                   Verify Email
                </a>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p>${verificationLink}</p>
                <hr>
                <p style="font-size: 12px; color: #777;">If you did not request this, please ignore this email.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

const generateAndSendOtp = async (email) => {

    const otp = Math.floor(100000 + Math.random() * 900000);
    const user = await User.findOne({ email })
    if (!user) {
        throw new Error("User Not Found")
    }
    encryptedOtp = await bcrypt.hash(otp.toString(), 10)
    user.otp = encryptedOtp
    await user.save()
    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: "Your OTP Code",
        html: `
            <p>Hi,</p>
            <p><b>${otp}</b> is your verification OTP. Please do not share it with anyone.</p>
            `
    };
    await transporter.sendMail(mailOptions);
}

app.get('/', (req, res) => {
    res.send('Server is live! This is my first chat-app using websockets and rest apis together using mongodb');
});

app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const isExistingUser = await User.findOne({ username: username })
        const isExistingEmail = await User.findOne({ email })
        if (isExistingUser) {
            return res.status(400).send({ error_msg: "User Already Exists" })
        }
        if (isExistingEmail) {
            return res.status(400).send({ error_msg: "Email Already Exists" })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,

        })

        const payload = { username: newUser.username, email: newUser.email }
        const token = jwt.sign(payload, process.env.EMAIL_TOKEN, { expiresIn: "3m" })
        sendVerificationEmail(email, token)
        res.status(201).send({ message: "User Created Successfully. Please check your email to verify your account." })
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
})

app.get("/verify", async (req, res) => {
    const { token } = req.query
    try {
        const decoded = jwt.verify(token, process.env.EMAIL_TOKEN)
        const user = await User.findOne({ email: decoded.email })

        if (!user) {
            return res.status(400).send({ error_msg: "Invalid Token" })
        }

        if (user.isVerified) {
            return res.status(400).send({ error_msg: "Email already verified" });
        }

        user.isVerified = true;
        await user.save(); // ✅ Saves the changes

        res.status(200).send({ message: "Email Verified Successfully! You can now log in." })
    }
    catch (err) {
        res.status(500).send({ error_msg: err.message })
    }
})

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body

        const existingUser = await User.findOne({ username })

        if (!existingUser) {
            return res.status(404).json({ error_msg: "User Not Found" })
        }

        if (!existingUser.isVerified) {
            return res.status(401).send({ error_msg: "Please verify The Email to Proceed Further" })
        }

        const isPasswordMatched = await bcrypt.compare(password, existingUser.password)

        if (!isPasswordMatched) {
            return res.status(401).send({ error_msg: "Password is not correct" })
        }


        const payload = { userId: existingUser._id, username: existingUser.username, isVerified: existingUser.isVerified }
        const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "3d" })
        return res.status(200).send({ message: "User Logged In Successfully", jwtToken })
    }
    catch (err) {
        res.status(500).json({ error_msg: err.msg })
    }




})

app.post('/sendOtp', async (req, res) => {
    try {
        const { email } = req.body
        await generateAndSendOtp(email)
        return res.status(200).json({ message: "OTP has been sent to your email! Please check your inbox."})
    }
    catch (err) {
        return res.status(500).json({ err_msg: err.message })
    }
})

app.post("/verifyOtp", async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ email })

    if (!user) {
        return res.status(404).json({ err_msg: "User Not Found" })
    }

    let isOtpMatched = await bcrypt.compare(otp.toString(), user.otp)

    if (!isOtpMatched) {
        return res.status(400).json({ err_msg: "Otp is Invalid!" })
    }

    return res.status(200).json({ message: "Otp Verified Successfully!" })
})

app.post("/resetPassword", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ err_msg: "User Not Found" });
        }

        const encryptedPassword = await bcrypt.hash(password, 10);

        user.password = encryptedPassword;
        user.otp=""
        await user.save();

        res.status(200).json({ msg: "Password reset successful" });
    } catch (error) {
        res.status(500).json({ err_msg: "Server Error", error: error.message });
    }
});



const PORT = process.env.PORT || 5005;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));