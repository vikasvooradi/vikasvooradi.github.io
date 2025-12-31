#!/usr/bin/env node

/**
 * Generate questions.json with FULL CONTENT embedded
 * This eliminates runtime GitHub API calls entirely
 */

const https = require('https');
const fs = require('fs');

const CONFIG = {
  username: process.env.GITHUB_REPOSITORY_OWNER || 'vikasvooradi',
  // Changed: Only look for 'datix' repository
  targetRepoName: 'datix',
  sqlKeywords: ['sql', 'oracle', 'mysql', 'postgresql', 'postgres'],
  outputFile: 'questions.json',
  requireSqlInName: false,
  rateLimitDelay: 100,
  batchSize: 10,
};

// GitHub API helper with retry logic
async function fetchGitHub(path, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.github.com',
          path: path,
          method: 'GET',
          headers: {
            'User-Agent': 'SQL-Portfolio-Generator',
            'Accept': 'application/vnd.github.v3+json'
          }
        };

        if (process.env.GITHUB_TOKEN) {
          options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }

        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            const remaining = res.headers['x-ratelimit-remaining'];
            const resetTime = res.headers['x-ratelimit-reset'];
            
            if (remaining && parseInt(remaining) < 10) {
              console.warn(`⚠️  Low API rate limit: ${remaining} requests remaining`);
              console.warn(`   Resets at: ${new Date(parseInt(resetTime) * 1000).toLocaleString()}`);
            }

            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error('Invalid JSON response'));
              }
            } else if (res.statusCode === 404) {
              resolve(null);
            } else if (res.statusCode === 403) {
              reject(new Error(`Rate limit exceeded. Reset at: ${new Date(parseInt(resetTime) * 1000).toLocaleString()}`));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        req.end();
      });

      return data;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      console.warn(`   Retry ${attempt}/${retries} after error: ${error.message}`);
      await sleep(1000 * attempt);
    }
  }
}

// Fetch raw content from GitHub
async function fetchRawContent(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'SQL-Portfolio-Generator' } }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.warn(`   Failed to fetch content: ${err.message}`);
      resolve(null);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTitle(dirName) {
  return dirName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

async function generateQuestions() {
  console.log('🚀 Starting question generation with full content embedding...');
  console.log(`📦 Fetching repositories for user: ${CONFIG.username}`);

  try {
    const repos = await fetchGitHub(`/users/${CONFIG.username}/repos?per_page=100`);
    
    if (!repos || repos.length === 0) {
      console.error('❌ No repositories found');
      process.exit(1);
    }

    console.log(`✓ Found ${repos.length} repositories`);

    // Changed: Find only the 'datix' repository
    const datixRepo = repos.find(repo => 
      repo.name.toLowerCase() === CONFIG.targetRepoName.toLowerCase()
    );

    if (!datixRepo) {
      console.error(`❌ Repository '${CONFIG.targetRepoName}' not found`);
      console.log('Available repositories:', repos.map(r => r.name).join(', '));
      process.exit(1);
    }

    console.log(`\n✓ Found datix repository: ${datixRepo.name}`);

    const questions = [];
    let totalApiCalls = 0;

    // Changed: Process only datix repo, always use "DATIX" as platform
    const platform = 'DATIX';
    console.log(`\n📂 Processing ${datixRepo.name} (platform: ${platform})...`);

    await sleep(CONFIG.rateLimitDelay);
    totalApiCalls++;

    try {
      const contents = await fetchGitHub(`/repos/${CONFIG.username}/${datixRepo.name}/contents`);
        
        if (!contents) {
          console.error(`  ❌ Could not fetch contents from datix repository`);
          process.exit(1);
        }

        const dirs = contents.filter(item => item.type === 'dir');
        console.log(`  ✓ Found ${dirs.length} directories`);

        for (let i = 0; i < dirs.length; i += CONFIG.batchSize) {
          const batch = dirs.slice(i, i + CONFIG.batchSize);
          
          for (const dir of batch) {
            await sleep(CONFIG.rateLimitDelay);
            totalApiCalls++;

            try {
              const files = await fetchGitHub(
                `/repos/${CONFIG.username}/${datixRepo.name}/contents/${dir.name}`
              );

              if (!files) continue;

              const sqlFile = files.find(f => 
                f.name.toLowerCase().endsWith('.sql')
              );

              if (sqlFile) {
                const readmeFile = files.find(f => {
                  const name = f.name.toLowerCase();
                  return name === 'read.me' || 
                         name === 'readme.md' || 
                         name === 'readme.txt' ||
                         name.startsWith('readme');
                });

                console.log(`    📥 Fetching content for ${dir.name}...`);
                
                const [sqlContent, readmeContent] = await Promise.all([
                  fetchRawContent(sqlFile.download_url),
                  readmeFile ? fetchRawContent(readmeFile.download_url) : Promise.resolve(null)
                ]);

                const question = {
                  platform: platform,
                  title: formatTitle(dir.name),
                  repo: datixRepo.name,
                  path: dir.name,
                  sqlCode: sqlContent,
                  description: readmeContent,
                  tags: ['ORACLE']
                };

                questions.push(question);
                console.log(`    ✓ ${question.title} (${sqlContent ? sqlContent.length : 0} chars SQL, ${readmeContent ? readmeContent.length : 0} chars desc)`);
              }
            } catch (error) {
              console.log(`    ⚠️  Error processing ${dir.name}: ${error.message}`);
            }
          }

          if (i + CONFIG.batchSize < dirs.length) {
            await sleep(500);
          }
        }
      } catch (error) {
        console.log(`  ⚠️  Error processing repo: ${error.message}`);
      }

    if (questions.length === 0) {
      console.error('\n❌ No SQL questions found in datix repository');
      process.exit(1);
    }

    // Changed: Sort by title only (single platform)
    questions.sort((a, b) => a.title.localeCompare(b.title));

    fs.writeFileSync(
      CONFIG.outputFile,
      JSON.stringify(questions, null, 2),
      'utf8'
    );

    const fileSize = fs.statSync(CONFIG.outputFile).size;
    console.log(`\n✅ Success! Generated ${CONFIG.outputFile}`);
    console.log(`📊 Statistics:`);
    console.log(`   • Questions: ${questions.length}`);
    console.log(`   • Platform: DATIX`);
    console.log(`   • Repository: ${datixRepo.name}`);
    console.log(`   • File size: ${(fileSize / 1024).toFixed(2)} KB`);
    console.log(`   • Total API calls: ${totalApiCalls}`);
    console.log(`   • Avg content per question: ${(fileSize / questions.length / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

generateQuestions();
