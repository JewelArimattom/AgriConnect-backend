const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  location: {
    type: String,
    required: true
  },
  description: { 
    type: String, 
    required: true 
  },
  imageUrl: { 
    type: String, 
    required: true 
  },
  farmer: { 
    type: String, 
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Vegetables',
      'Fruits',
      'Grains & Pulses',
      'Spices & Herbs',
      'Dairy & Milk Products',
      'Animal',
      'Fertilizers',
      'Seeds',
      'Plants',
      'Bio-Fertilizers',
      'Homemade Foods',
      'Farm Tools & Equipment',
      'Dry Fruits & Nuts',
      'Honey & Bee Products',
    ]
  },
  buyType: {
    type: String,
    required: true,
    enum: ['direct_buy', 'enquiry', 'auction'],
    default: 'direct_buy'
  },
  price: { 
    type: String, 
    required: function() { return this.buyType === 'direct_buy'; }
  },
  auctionStartTime: {
    type: Date,
    required: function() { return this.buyType === 'auction'; }
  },
  auctionEndTime: {
    type: Date,
    required: function() { return this.buyType === 'auction'; }
  },
  startingBid: {
    type: Number,
    required: function() { return this.buyType === 'auction'; }
  },
  currentPrice: {
    type: Number,
  },
  highestBidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  bids: [
    {
      bidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      amount: {
        type: Number,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  inStock: {
    type: Boolean,
    default: true
  },
  organic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true 
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;