const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerDetails: {
    name: { 
      type: String, 
      required: true 
    },
    email: { 
      type: String, 
      required: true 
    },
    phone: {
      type: String,
      required: true
    },
    preferredPickupTime: {
      type: String,
      required: false
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'pickup'],
      default: 'pickup'
    },
    specialInstructions: {
      type: String,
      required: false
    }
  },
  products: [{
    productId: {
      type: String,
      required: true
    },
    name: { 
      type: String, 
      required: true 
    },
    price: { 
      type: String, 
      required: true 
    },
    quantity: { 
      type: Number, 
      default: 1
    }
  }],
  totalAmount: { 
    type: Number, 
    required: true 
  },
  status: {
    type: String,
    enum: ['Confirmed', 'Ready for Pickup', 'Completed'],
    default: 'Confirmed'
  },
  farmer: { 
    type: String, 
    required: true 
  }
}, { 
  timestamps: true 
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;