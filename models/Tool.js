const mongoose = require('mongoose');

const toolSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  // --- ADDED THIS FIELD ---
  description: { 
    type: String 
  },
  category: {
    type: String,
    required: true,
    enum: ['Vehicles', 'Tools', 'Soil Preparation', 'power Tools']
  },
  imageUrl: { 
    type: String 
  },
  pricePerDay: { 
    type: Number, 
    required: true 
  },
  location: { 
    type: String, 
    required: true 
  },
  available: {
    type: Boolean,
    default: true
  },
  listedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true 
});

const Tool = mongoose.model('Tool', toolSchema);

module.exports = Tool;