
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';

// Import modules with error handling - moved inside async function
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

function maskMongoUri(uri) {
  if (!uri) return "[NOT SET]";
  return uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

console.log("Starting Police Management System with MongoDB Atlas...");
console.log(`MONGODB_URI = ${maskMongoUri(process.env.MONGODB_URI)}`);

// Check if MongoDB URI is set
if (!process.env.MONGODB_URI) {
  console.warn('⚠️ MONGODB_URI environment variable is not set');
  console.log('🔄 Starting server in fallback mode without database...');
}

const app = express();
const server = createServer(app);

// Configure multer for geofile uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.shp', '.kml', '.geojson', '.csv', '.gpx', '.kmz', '.gml'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Configure multer for custodial records (ID photos)
const uploadCustodial = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for photos
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedImageTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file type. Only JPG, PNG, JPEG allowed'), false);
    }
  }
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'police-management-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

async function startServer() {
  console.log('🚀 Starting server initialization...');
  let mongoConnected = false;
  
  // Import modules with error handling
  let connectToMongoDB, registerMongoDBRoutes, registerEvidenceRoutes, registerCustodialRoutes, setupVite, log, seedGeofiles;

  console.log('📦 Loading modules...');
  
  try {
    console.log('  - Loading MongoDB connection module...');
    const mongoConnection = await import('./mongodb-connection.js');
    connectToMongoDB = mongoConnection.connectToMongoDB;
    console.log('  ✅ MongoDB connection module loaded');
  } catch (error) {
    console.warn('  ⚠️ MongoDB connection module not found:', error.message);
    connectToMongoDB = null;
  }

  try {
    console.log('  - Loading MongoDB routes module...');
    const mongoRoutes = await import('./mongodb-routes.js');
    registerMongoDBRoutes = mongoRoutes.registerMongoDBRoutes;
    console.log('  ✅ MongoDB routes module loaded');
  } catch (error) {
    console.warn('  ⚠️ MongoDB routes module not found:', error.message);
    registerMongoDBRoutes = null;
  }

  try {
    console.log('  - Loading Evidence routes module...');
    const evidenceRoutes = await import('./evidence-routes.js');
    registerEvidenceRoutes = evidenceRoutes.registerEvidenceRoutes;
    console.log('  ✅ Evidence routes module loaded');
  } catch (error) {
    console.warn('  ⚠️ Evidence routes module not found:', error.message);
    registerEvidenceRoutes = null;
  }

  try {
    console.log('  - Loading Custodial routes module...');
    const custodialRoutes = await import('./custodial-routes.js');
    registerCustodialRoutes = custodialRoutes.registerCustodialRoutes;
    console.log('  ✅ Custodial routes module loaded');
  } catch (error) {
    console.warn('  ⚠️ Custodial routes module not found:', error.message);
    registerCustodialRoutes = null;
  }

  try {
    console.log('  - Loading Vite module...');
    const viteModule = await import('./vite.js');
    setupVite = viteModule.setupVite;
    log = viteModule.log || console.log;
    console.log('  ✅ Vite module loaded');
  } catch (error) {
    console.warn('  ⚠️ Vite module not found:', error.message);
    setupVite = null;
    log = console.log;
  }

  try {
    console.log('  - Loading Seed geofiles module...');
    const seedModule = await import('./seed-geofiles.js');
    seedGeofiles = seedModule.seedGeofiles;
    console.log('  ✅ Seed geofiles module loaded');
  } catch (error) {
    console.warn('  ⚠️ Seed geofiles module not found:', error.message);
    seedGeofiles = null;
  }

  console.log('🔗 Attempting MongoDB connection...');
  if (connectToMongoDB) {
    try {
      console.log('  - Calling connectToMongoDB...');
      await connectToMongoDB();
      console.log('✅ MongoDB connected successfully!');
      mongoConnected = true;
    } catch (error) {
      console.warn('⚠️ MongoDB connection failed:', error.message);
      console.log('🔄 Starting server in fallback mode without database...');
      mongoConnected = false;
    }
  } else {
    console.warn('⚠️ MongoDB connection module not available');
    console.log('🔄 Starting server in fallback mode without database...');
    mongoConnected = false;
  }

  console.log('⚙️ Setting up Express routes...');

  // Register routes (only if MongoDB is connected for database routes)
  if (mongoConnected && registerMongoDBRoutes) {
    try {
      console.log('  - Registering MongoDB routes...');
      registerMongoDBRoutes(app, upload, uploadCustodial);
      console.log('  ✅ MongoDB Routes registered successfully');
    } catch (error) {
      console.warn('  ⚠️ Failed to register MongoDB routes:', error.message);
    }
  }

  if (mongoConnected && registerEvidenceRoutes) {
    try {
      console.log('  - Registering Evidence Routes...');
      registerEvidenceRoutes(app, upload);
      console.log('  ✅ Evidence Routes registered successfully');
    } catch (error) {
      console.warn('  ⚠️ Failed to register evidence routes:', error.message);
    }
  }

  if (mongoConnected && registerCustodialRoutes) {
    try {
      console.log('  - Registering Custodial Routes...');
      registerCustodialRoutes(app);
      console.log('  ✅ Custodial Routes registered successfully');
    } catch (error) {
      console.warn('  ⚠️ Failed to register custodial routes:', error.message);
    }
  }

    // Import and register additional routes (optional)
    try {
      const additionalRoutes = await import('./api-routes.js');
      if (additionalRoutes && additionalRoutes.registerAdditionalRoutes) {
        additionalRoutes.registerAdditionalRoutes(app);
        console.log('✅ Additional routes loaded successfully');
      }
    } catch (error) {
      console.log('⚠️  Additional routes file not found - continuing without it');
    }

    // Serve uploaded files statically
    app.use('/uploads', express.static('uploads'));

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        mongodb: mongoConnected ? 'connected' : 'disconnected',
        message: mongoConnected ? 'All systems operational' : 'Running in fallback mode - update MongoDB URI in .env'
      });
    });

    // Basic fallback route when MongoDB is not connected
    if (!mongoConnected) {
      app.get('/api/*', (req, res) => {
        res.status(503).json({
          message: 'Database not available. Please configure MongoDB URI in .env file.',
          status: 'service_unavailable'
        });
      });
    }

    // Frontend serving
    if (process.env.NODE_ENV === 'production') {
      // Serve static files from React build
      const buildPath = path.join(__dirname, '../dist/public');
      app.use(express.static(buildPath));

      // Handle React Router - send all non-API requests to index.html
      app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile(path.join(buildPath, 'index.html'));
        }
      });
    } else {
      // Development mode
      if (setupVite) {
        try {
          console.log('  - Setting up Vite development server...');
          await setupVite(app, server);
          console.log('  ✅ Vite development server setup complete');
        } catch (error) {
          console.warn('  ⚠️ Failed to setup Vite:', error.message);
          // Fallback to simple HTML
          app.get('*', (req, res) => {
            if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
              res.send(`
                <!DOCTYPE html>
                <html>
                  <head><title>Police Management System</title></head>
                  <body>
                    <h1>Police Management System</h1>
                    <p>Server is running! MongoDB: ${mongoConnected ? 'Connected' : 'Disconnected'}</p>
                    <p>API Health Check: <a href="/api/health">/api/health</a></p>
                  </body>
                </html>
              `);
            }
          });
        }
      } else {
        // Fallback: serve a simple HTML page
        app.get('*', (req, res) => {
          if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.send(`
              <!DOCTYPE html>
              <html>
                <head><title>Police Management System</title></head>
                <body>
                  <h1>Police Management System</h1>
                  <p>Server is running! MongoDB: ${mongoConnected ? 'Connected' : 'Disconnected'}</p>
                  <p>API Health Check: <a href="/api/health">/api/health</a></p>
                </body>
              </html>
            `);
          }
        });
      }
    }

    // Seed development data in background (non-blocking)
    if (mongoConnected) {
      setImmediate(async () => {
        try {
          if (seedGeofiles) {
            console.log('🌱 Seeding sample geofiles in background...');
            await seedGeofiles();
          }

          // Seed admin user for login
          try {
            console.log('🌱 Seeding admin user in background...');
            const { seedAdminUser } = await import('./seed-admin.js');
            await seedAdminUser();
          } catch (error) {
            console.warn('⚠️ Failed to seed admin user:', error.message);
          }
        } catch (error) {
          console.warn('⚠️ Failed to seed data:', error.message);
        }
      });
    }

    console.log('🚀 Starting HTTP server...');
    const port = parseInt(process.env.PORT || '5000', 10);
    
    console.log(`📡 Attempting to bind server to port ${port}...`);
    
    server.listen(port, '0.0.0.0', () => {
      console.log(`🎉 Police Management System is LIVE!`);
      console.log(`🌐 Server URL: http://0.0.0.0:${port}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 MongoDB: ${mongoConnected ? '✅ Connected' : '❌ Disconnected (Fallback Mode)'}`);
      console.log(`🔧 Routes: ${mongoConnected ? 'Full API Available' : 'Limited (No Database)'}`);
      console.log(`📋 Health Check: http://0.0.0.0:${port}/api/health`);
      
      if (!mongoConnected) {
        console.log(`⚠️  Database Status: Update MONGODB_URI in .env to enable full functionality`);
      }
      
      console.log('✅ Server startup complete - ready to accept connections!');
    });

    server.on('error', (error) => {
      console.error('❌ Server error:', error.message);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
      }
      process.exit(1);
    });
}

// Start the server with error handling
console.log('🏁 Initiating server startup...');
startServer().catch(error => {
  console.error('💥 Fatal error during server startup:', error.message);
  console.error('Stack trace:', error.stack);
  console.log('🔧 Server failed to start. Check the error above for details.');
  process.exit(1);
});
