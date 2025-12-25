#!/usr/bin/env node

/**
 * Generate questions.json from GitHub repositories
 * This script scans your SQL practice repos and creates a static data file
 */

const https = require('https');
const fs = require('fs');

const CONFIG = {
  username: 'vikasvooradi',
  platforms: ['leetcode', 'hackerrank', 'codechef', 'codewars', 'lintcode', 'datalemur'],
  outputFile: 'questions.json'
};

// GitHub API helper
function fetchGitHub(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'SQL-Portfolio-Generator',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    // Add token if available
    if (process.env.GITHUB_TOKEN) {
      options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Rate limiting helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Format directory name to title
function formatTitle(dirName) {
  return dirName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

// Main function
async function generateQuestions() {
  console.log('🚀 Starting question generation...');
  console.log(`📦 Fetching repositories for user: ${CONFIG.username}`);

  try {
    // Fetch all repositories
    const repos = await fetchGitHub(`/users/${CONFIG.username}/repos?per_page=100`);
    
    if (!repos || repos.length === 0) {
      console.error('❌ No repositories found');
      process.exit(1);
    }

    console.log(`✓ Found ${repos.length} repositories`);

    // Filter SQL-related repos
    const relevantRepos = repos.filter(repo => 
      CONFIG.platforms.some(platform => 
        repo.name.toLowerCase().includes(platform)
      ) && repo.name.toLowerCase().includes('sql')
    );

    console.log(`✓ Found ${relevantRepos.length} SQL practice repositories`);

    if (relevantRepos.length === 0) {
      console.error('❌ No SQL repositories found');
      process.exit(1);
    }

    const questions = [];

    // Process each repository
    for (const repo of relevantRepos) {
      const platform = CONFIG.platforms.find(p => 
        repo.name.toLowerCase().includes(p)
      );

      console.log(`\n📂 Processing ${repo.name}...`);

      await sleep(100); // Rate limiting

      try {
        // Get repository contents
        const contents = await fetchGitHub(`/repos/${CONFIG.username}/${repo.name}/contents`);
        
        if (!contents) {
          console.log(`  ⚠️  Could not fetch contents`);
          continue;
        }

        // Get all directories
        const dirs = contents.filter(item => item.type === 'dir');
        console.log(`  ✓ Found ${dirs.length} directories`);

        // Check each directory for SQL files
        for (const dir of dirs) {
          await sleep(100); // Rate limiting

          try {
            const files = await fetchGitHub(
              `/repos/${CONFIG.username}/${repo.name}/contents/${dir.name}`
            );

            if (!files) continue;

            // Find SQL file
            const sqlFile = files.find(f => 
              f.name.toLowerCase().endsWith('.sql')
            );

            if (sqlFile) {
              // Find README file
              const readmeFile = files.find(f => 
                f.name.toLowerCase() === 'read.me' || 
                f.name.toLowerCase() === 'readme.md'
              );

              const question = {
                platform: platform,
                title: formatTitle(dir.name),
                repo: repo.name,
                path: dir.name,
                sqlUrl: sqlFile.download_url,
                readmeUrl: readmeFile ? readmeFile.download_url : null
              };

              questions.push(question);
              console.log(`    ✓ ${question.title}`);
            }
          } catch (error) {
            console.log(`    ⚠️  Error processing ${dir.name}: ${error.message}`);
          }
        }
      } catch (error) {
        console.log(`  ⚠️  Error processing repo: ${error.message}`);
      }
    }

    if (questions.length === 0) {
      console.error('\n❌ No SQL questions found');
      process.exit(1);
    }

    // Sort questions
    questions.sort((a, b) => {
      const platformCompare = a.platform.localeCompare(b.platform);
      if (platformCompare !== 0) return platformCompare;
      return a.title.localeCompare(b.title);
    });

    // Write to file
    fs.writeFileSync(
      CONFIG.outputFile,
      JSON.stringify(questions, null, 2),
      'utf8'
    );

    console.log(`\n✅ Success! Generated ${CONFIG.outputFile} with ${questions.length} questions`);
    console.log(`📊 Platforms: ${[...new Set(questions.map(q => q.platform))].join(', ')}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
generateQuestions();

