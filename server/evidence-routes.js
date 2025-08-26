
import { getDatabase } from './mongodb-connection.js';
import { ObjectId } from 'mongodb';

// Evidence CRUD operations
class EvidenceCRUD {
  static async create(evidenceData) {
    const db = getDatabase();
    const collection = db.collection('evidence');
    
    // Generate evidence number if not provided
    if (!evidenceData.evidenceNumber) {
      const count = await collection.countDocuments();
      evidenceData.evidenceNumber = `EV-${String(count + 1).padStart(6, '0')}`;
    }
    
    evidenceData.createdAt = new Date();
    evidenceData.updatedAt = new Date();
    
    const result = await collection.insertOne(evidenceData);
    return { _id: result.insertedId, ...evidenceData };
  }

  static async findAll() {
    const db = getDatabase();
    const collection = db.collection('evidence');
    return await collection.find({}).toArray();
  }

  static async findById(id) {
    const db = getDatabase();
    const collection = db.collection('evidence');
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  static async update(id, updateData) {
    const db = getDatabase();
    const collection = db.collection('evidence');
    updateData.updatedAt = new Date();
    
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    return result.modifiedCount > 0;
  }

  static async delete(id) {
    const db = getDatabase();
    const collection = db.collection('evidence');
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}

export function registerEvidenceRoutes(app, upload) {
  console.log('📋 Registering Evidence Routes...');

  // Get all evidence
  app.get('/api/evidence', async (req, res) => {
    try {
      console.log('🔍 API: Fetching all evidence');
      const evidence = await EvidenceCRUD.findAll();
      
      const transformedEvidence = evidence.map(item => ({
        id: item._id.toString(),
        ...item
      }));

      res.json({ evidence: transformedEvidence });
    } catch (error) {
      console.error('❌ API: Error fetching evidence:', error);
      res.status(500).json({ error: 'Failed to fetch evidence' });
    }
  });

  // Get evidence by ID
  app.get('/api/evidence/:id', async (req, res) => {
    try {
      console.log('🔍 API: Fetching evidence by ID:', req.params.id);
      const evidence = await EvidenceCRUD.findById(req.params.id);

      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }

      const transformedEvidence = {
        id: evidence._id.toString(),
        ...evidence
      };

      res.json({ evidence: transformedEvidence });
    } catch (error) {
      console.error('❌ API: Error fetching evidence by ID:', error);
      res.status(500).json({ error: 'Failed to fetch evidence' });
    }
  });

  // Create new evidence
  app.post('/api/evidence', async (req, res) => {
    try {
      console.log('🔍 API: Creating new evidence with data:', req.body);

      // Add default collectedBy if not provided
      const evidenceData = {
        ...req.body,
        collectedBy: req.body.collectedBy || 'Unknown Officer'
      };

      // Validate required fields
      const { type, description, location } = evidenceData;
      if (!type || !description || !location) {
        return res.status(400).json({ 
          error: 'Missing required fields: type, description, location' 
        });
      }

      const evidence = await EvidenceCRUD.create(evidenceData);

      const transformedEvidence = {
        id: evidence._id.toString(),
        ...evidence
      };

      console.log('✅ API: Evidence created successfully');
      res.status(201).json({ 
        success: true, 
        evidence: transformedEvidence,
        message: 'Evidence created successfully'
      });
    } catch (error) {
      console.error('❌ API: Error creating evidence:', error);
      if (error.code === 11000) {
        res.status(409).json({ error: 'Evidence number already exists' });
      } else {
        res.status(500).json({ error: 'Failed to create evidence' });
      }
    }
  });

  // Update evidence
  app.put('/api/evidence/:id', async (req, res) => {
    try {
      console.log('🔍 API: Updating evidence:', req.params.id);
      const success = await EvidenceCRUD.update(req.params.id, req.body);

      if (!success) {
        return res.status(404).json({ error: 'Evidence not found' });
      }

      const updatedEvidence = await EvidenceCRUD.findById(req.params.id);
      const transformedEvidence = {
        id: updatedEvidence._id.toString(),
        ...updatedEvidence
      };

      console.log('✅ API: Evidence updated successfully');
      res.json({ 
        success: true, 
        evidence: transformedEvidence,
        message: 'Evidence updated successfully'
      });
    } catch (error) {
      console.error('❌ API: Error updating evidence:', error);
      res.status(500).json({ error: 'Failed to update evidence' });
    }
  });

  // Delete evidence
  app.delete('/api/evidence/:id', async (req, res) => {
    try {
      console.log('🔍 API: Deleting evidence:', req.params.id);
      const success = await EvidenceCRUD.delete(req.params.id);

      if (!success) {
        return res.status(404).json({ error: 'Evidence not found' });
      }

      console.log('✅ API: Evidence deleted successfully');
      res.json({ 
        success: true,
        message: 'Evidence deleted successfully'
      });
    } catch (error) {
      console.error('❌ API: Error deleting evidence:', error);
      res.status(500).json({ error: 'Failed to delete evidence' });
    }
  });

  console.log('✅ Evidence Routes registered successfully');
}
