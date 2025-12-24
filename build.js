const https = require('https');
const fs = require('fs');

const CONFIG = {
    username: 'vikasvooradi',
    repository: 'leetcode-oracle',
    token: process.env.GITHUB_TOKEN
};

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Node.js',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        if (CONFIG.token) {
            options.headers['Authorization'] = `Bearer ${CONFIG.token}`;
        }

        https.get(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function extractProblemNumber(folderName) {
    const match = folderName.match(/^(\d+)/);
    return match ? match[1] : '';
}

function extractProblemTitle(folderName) {
    return folderName
        .replace(/^\d+[-._]\s*/, '')
        .replace(/[-_]/g, ' ')
        .trim();
}

async function scanRepository() {
    console.log('Fetching repository contents...');
    
    const repoUrl = `https://api.github.com/repos/${CONFIG.username}/${CONFIG.repository}/contents`;
    const contents = await httpsGet(repoUrl);
    
    const folders = contents.filter(item => item.type === 'dir');
    console.log(`Found ${folders.length} folders`);
    
    const problems = [];
    
    for (let i = 0; i < folders.length; i++) {
        const folder = folders[i];
        console.log(`Scanning ${i + 1}/${folders.length}: ${folder.name}`);
        
        try {
            const folderContents = await httpsGet(folder.url);
            
            let readmeFile = null;
            let sqlFile = null;
            
            for (const file of folderContents) {
                if (file.type === 'file') {
                    const fileName = file.name.toLowerCase();
                    if (fileName === 'readme.md') {
                        readmeFile = file;
                    } else if (fileName.endsWith('.sql')) {
                        sqlFile = file;
                    }
                }
            }
            
            if (readmeFile && sqlFile) {
                problems.push({
                    folderName: folder.name,
                    number: extractProblemNumber(folder.name),
                    title: extractProblemTitle(folder.name),
                    readmeUrl: readmeFile.download_url,
                    sqlUrl: sqlFile.download_url,
                    sqlFileName: sqlFile.name
                });
            }
        } catch (error) {
            console.error(`Error scanning ${folder.name}:`, error.message);
        }
    }
    
    return problems;
}

async function main() {
    try {
        if (!CONFIG.token) {
            console.error('ERROR: GITHUB_TOKEN environment variable is not set');
            process.exit(1);
        }

        const problems = await scanRepository();
        
        console.log(`\nSuccessfully scanned ${problems.length} problems`);
        
        const output = {
            generated: new Date().toISOString(),
            count: problems.length,
            problems: problems
        };
        
        fs.writeFileSync('problems.json', JSON.stringify(output, null, 2));
        console.log('✅ Generated problems.json');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();

