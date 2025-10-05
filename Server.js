require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');

// --- Model Imports ---
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Tool = require('./models/Tool');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// ---=============================---
// ---        API ROUTES           ---
// ---=============================---

// --- Authentication Routes ---
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const user = new User({ name, email, password });
    await user.save();
    
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      message: 'Server error during sign up',
      error: error.message 
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide both email and password' });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const isMatch = await user.matchPassword(password);
    
    if (isMatch) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email
      });
    } else {
      res.status(401).json({ message: 'Invalid password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login',
      error: error.message 
    });
  }
});

// --- Product Routes ---
app.post('/api/products', async (req, res) => {
  try {
    const productData = req.body;
    
    // Validate required fields
    const requiredFields = ['name', 'description', 'imageUrl', 'location', 'category', 'farmer', 'buyType'];
    const missingFields = requiredFields.filter(field => !productData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}`,
        fields: missingFields
      });
    }

    // Validate buyType specific fields
    if (productData.buyType === 'direct_buy' && !productData.price) {
      return res.status(400).json({ 
        message: 'Price is required for direct buy products'
      });
    }

    if (productData.buyType === 'auction') {
      if (!productData.startingBid) {
        return res.status(400).json({ 
          message: 'Starting bid is required for auction products'
        });
      }
      productData.currentPrice = productData.startingBid;
    }

    // Validate category
    const validCategories = [
      'Vegetables', 'Fruits', 'Grains & Pulses', 'Spices & Herbs',
      'Dairy & Milk Products', 'Animal', 'Fertilizers', 'Seeds',
      'Plants', 'Bio-Fertilizers', 'Homemade Foods',
      'Farm Tools & Equipment', 'Dry Fruits & Nuts', 'Honey & Bee Products'
    ];
    
    if (!validCategories.includes(productData.category)) {
      return res.status(400).json({
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    // Validate buyType
    const validBuyTypes = ['direct_buy', 'enquiry', 'auction'];
    if (!validBuyTypes.includes(productData.buyType)) {
      return res.status(400).json({
        message: `Invalid buy type. Must be one of: ${validBuyTypes.join(', ')}`
      });
    }

    const newProduct = new Product(productData);
    
    try {
      const product = await newProduct.save();
      res.status(201).json(product);
    } catch (validationError) {
      if (validationError.name === 'ValidationError') {
        const errors = Object.values(validationError.errors).map(err => err.message);
        return res.status(400).json({
          message: 'Validation failed',
          errors: errors
        });
      }
      throw validationError;
    }
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ 
      message: 'Server error creating product',
      error: error.message
    });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({}).limit(40);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching single product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Server error updating product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

app.get('/api/animal-products', async (req, res) => {
  try {
    const animalProducts = await Product.find({ category: 'Animal Products' }).limit(40);
    res.json(animalProducts);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching animal products' });
  }
});

app.post('/api/products/:id/bids', async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.buyType !== 'auction') {
      return res.status(404).json({ message: 'Auction product not found.' });
    }
    const now = new Date();
    if (now < product.auctionStartTime || now > product.auctionEndTime) {
      return res.status(400).json({ message: 'Auction is not currently active.' });
    }
    if (amount <= product.currentPrice) {
      return res.status(400).json({ message: `Bid must be higher than the current price of ${product.currentPrice}.` });
    }
    product.currentPrice = amount;
    product.highestBidder = userId;
    product.bids.push({ bidder: userId, amount });
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error placing bid.' });
  }
});

// --- USER CART ROUTES ---
app.get('/api/users/:userId/cart', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate({
            path: 'cart.productId', model: 'Product'
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user.cart.filter(item => item.productId));
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching cart' });
    }
});

app.post('/api/users/:userId/cart', async (req, res) => {
    const { productId, quantity = 1 } = req.body;
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        const itemIndex = user.cart.findIndex(item => item.productId && item.productId.toString() === productId);
        if (itemIndex > -1) {
            user.cart[itemIndex].quantity += quantity;
        } else {
            user.cart.push({ productId, quantity });
        }
        await user.save();
        const populatedUser = await user.populate({ path: 'cart.productId', model: 'Product' });
        res.status(200).json(populatedUser.cart.filter(item => item.productId));
    } catch (error) {
        res.status(500).json({ message: 'Server error adding to cart' });
    }
});

app.delete('/api/users/:userId/cart/:productId', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.userId, 
            { $pull: { cart: { 'productId': req.params.productId } } }, 
            { new: true }
        );
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'Item removed from cart' });
    } catch (error) {
        res.status(500).json({ message: 'Server error deleting item from cart' });
    }
});

app.delete('/api/users/:userId/cart', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        user.cart = [];
        await user.save();
        res.json({ message: 'Cart cleared' });
    } catch (error) {
        res.status(500).json({ message: 'Server error clearing cart' });
    }
});

// --- Order Routes ---
app.post('/api/orders', async (req, res) => {
    try {
        const { customerDetails, products, totalAmount, farmer } = req.body;
        
        // Validate required fields
        if (!customerDetails || !products || !totalAmount || !farmer) {
            return res.status(400).json({
                message: 'Missing required fields',
                details: 'Please provide customerDetails, products, totalAmount, and farmer'
            });
        }

        // Validate customer details
        if (!customerDetails.name || !customerDetails.email || !customerDetails.phone) {
            return res.status(400).json({
                message: 'Missing customer details',
                details: 'Name, email, and phone are required'
            });
        }

        // Validate products array
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                message: 'Invalid products',
                details: 'Products must be a non-empty array'
            });
        }

        // Format the order data
        const orderData = {
            customerDetails: {
                name: customerDetails.name.trim(),
                email: customerDetails.email.trim().toLowerCase(),
                phone: customerDetails.phone.trim(),
                preferredPickupTime: customerDetails.preferredPickupTime?.trim() || '',
                paymentMethod: customerDetails.paymentMethod || 'pickup',
                specialInstructions: customerDetails.specialInstructions?.trim() || ''
            },
            products: products.map(product => ({
                productId: product.productId,
                name: product.name.trim(),
                price: Number(product.price),
                quantity: Number(product.quantity) || 1
            })),
            totalAmount: Number(totalAmount),
            farmer: farmer.trim(),
            status: 'Confirmed'
        };

        // Create and save the order
        const newOrder = new Order(orderData);
        const savedOrder = await newOrder.save();

        console.log('Order created successfully:', savedOrder._id);
        res.status(201).json({
            message: 'Order created successfully',
            order: savedOrder
        });
    } catch (error) {
        console.error('Order creation error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation error',
                details: Object.values(error.errors).map(err => err.message)
            });
        }
        res.status(500).json({
            message: 'Server Error creating order',
            error: error.message
        });
    }
});

app.get('/api/orders/myorders/:customerName', async (req, res) => {
  try {
    const orders = await Order.find({ 'customerDetails.name': req.params.customerName });
    if (!orders) return res.status(404).json({ message: 'No orders found for this customer.' });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

app.put('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const { orderId } = req.params;

    // Validate status value
    const validStatuses = ['Confirmed', 'Ready for Pickup', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find and update the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Update the order status
    order.status = status;
    await order.save();

    // Send email notification if email is available
    if (order.customerDetails?.email) {
      try {
        const farmer = await User.findOne({ name: order.farmer });
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const statusMessages = {
          'Confirmed': 'Your order has been confirmed and is being processed.',
          'Ready for Pickup': 'Your order is ready for pickup! Please collect it at your convenience.',
          'Completed': 'Thank you for collecting your order. We hope you enjoy your fresh produce!'
        };

        const mailOptions = {
          from: `"AgriConnect" <${process.env.EMAIL_USER}>`,
          to: order.customerDetails.email,
          subject: `Your AgriConnect Order Status: ${status}`,
          replyTo: farmer?.email,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Order Status Update</h2>
              <p>Hello ${order.customerDetails.name},</p>
              <p>${statusMessages[status]}</p>
              <p>Order ID: #${order._id.slice(-8).toUpperCase()}</p>
              <p>Current Status: <strong>${status}</strong></p>
              <p>Total Amount: ₹${order.totalAmount.toFixed(2)}</p>
              <hr>
              <p>If you have any questions, you can reply to this email to contact the farmer directly.</p>
              <p>Thank you for using AgriConnect!</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('Status update email sent to:', order.customerDetails.email);
      } catch (emailError) {
        console.error("Failed to send status update email:", emailError);
        // Continue with the response even if email fails
      }
    }

    // Send success response
    res.json({ 
      message: 'Order status updated successfully',
      order 
    });

  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ 
      message: 'Failed to update order status',
      error: error.message 
    });
  }
});

// --- Dashboard Routes ---
app.get('/api/dashboard/products/:farmerName', async (req, res) => {
  try {
    const products = await Product.find({ farmer: req.params.farmerName });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching farmer products' });
  }
});

app.get('/api/dashboard/orders/:farmerName', async (req, res) => {
  try {
    const orders = await Order.find({ farmer: req.params.farmerName });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching farmer orders' });
  }
});

// --- TOOL RENTAL ROUTES ---
app.get('/api/tools', async (req, res) => {
  try {
    const tools = await Tool.find({}).populate('listedBy', 'name').limit(40);
    res.json(tools);
  } catch (error) {
    console.error("Error fetching tools:", error);
    res.status(500).json({ message: 'Server error fetching tools' });
  }
});

app.post('/api/tools', async (req, res) => {
  try {
    const newTool = new Tool(req.body);
    const savedTool = await newTool.save();
    res.status(201).json(savedTool);
  } catch (error) {
    res.status(500).json({ message: 'Server error creating tool listing' });
  }
});

app.get('/api/tools/:id', async (req, res) => {
  try {
    const tool = await Tool.findById(req.params.id).populate('listedBy', 'name');
    if (!tool) {
      return res.status(404).json({ message: 'Tool not found' });
    }
    res.json(tool);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching tool' });
  }
});

app.get('/', (req, res) => {
  res.send('AgriConnect API');
})
// --- Server Listener ---
module.exports = app;