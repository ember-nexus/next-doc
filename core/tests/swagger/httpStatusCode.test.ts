import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const PATHS_DIR = join(import.meta.dirname, '../../src/data/swagger/paths')
const THREE_DIGIT_NUMBER = /\b\d{3}\b/g

const testCases = readdirSync(PATHS_DIR, { recursive: true })
    .filter(filename => filename.endsWith('.json'))
    .flatMap(filename => {
        const statusCode = filename.match(/\b(\d{3})\b/)?.[1]
        if (!statusCode) return []
        return [{ filename, statusCode, fullPath: join(PATHS_DIR, filename) }]
    })

describe('Swagger path files — status code integrity', () => {

    it('at least one test file was found', () => {
        expect(testCases.length).toBeGreaterThan(0)
    })

    describe.each(testCases)('$filename (status: $statusCode)', ({ filename, statusCode, fullPath }) => {
        const content = readFileSync(fullPath, 'utf-8')
        const foundCodes = [...new Set(content.match(THREE_DIGIT_NUMBER) ?? [])]

        it('contains the expected status code', () => {
            expect(foundCodes, `file ${filename} does not contain status code ${statusCode}`).toContain(statusCode)
        })

        it('contains no other 3-digit codes', () => {
            const unexpected = foundCodes.filter(code => code !== statusCode)
            expect(unexpected, `unexpected codes found in file ${filename}: ${unexpected.join(', ')}`).toHaveLength(0)
        })
    })

})
