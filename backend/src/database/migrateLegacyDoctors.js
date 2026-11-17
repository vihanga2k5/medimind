
import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import {
    connectDatabase,
    disconnectDatabase,
} from '../config/db.js'

const DEMO_NAMES = [
    'Aminda Kalpage',
    'Malitha Bandara',
    'Cheveen Ranasinghe',
    'Basuru Wijesinghe',
    'Shabjan',
    'Vihanga A. Hettiarachchi',
    'Sudam Rajapakshe',
    'Zaheer Abbas',
    'Dhanushi Navarathana',
    'Lakshitha Banda',
    'Dihasa Dihasa',
    'Suchith the BugBear',
    'Bob Odenkirk',
]

const DAY_MAP = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
}

function migrateAvailability(doctor, index) {
    // First doctor receives the same weekly schedule as the seed script.
    if (index === 0) {
        return Array.from({ length: 7 }, (_, dayOfWeek) => ({
            dayOfWeek,
            startTime: '09:00',
            endTime: '17:00',
            slotMinutes: 30,
        }))
    }

    return (doctor.availability || []).map(block => ({
        dayOfWeek:
            typeof block.dayOfWeek === 'number'
                ? block.dayOfWeek
                : DAY_MAP[block.dayOfWeek],
        startTime: block.startHour || block.startTime,
        endTime: block.endHour || block.endTime,
        slotMinutes: 30,
    }))
}

async function main() {
    const apply = process.argv.includes('--apply')

    try {
        await connectDatabase()

        const db = mongoose.connection.db

        if (db.databaseName !== 'medimind_db') {
            throw new Error(
                `Wrong database: ${db.databaseName}. Expected medimind_db.`,
            )
        }

        const backupPath = path.resolve(
            process.cwd(),
            '../database-backups/medimind-before-migration/medimind_db/doctors.bson',
        )

        if (!fs.existsSync(backupPath)) {
            throw new Error('Doctor backup not found. Migration stopped.')
        }

        const doctors = await db.collection('doctors')
            .find({})
            .sort({ _id: 1 })
            .toArray()

        if (doctors.length !== 20) {
            throw new Error(
                `Expected 20 doctors, found ${doctors.length}. Migration stopped.`,
            )
        }

        const userIds = doctors.map(doctor => doctor.userId)

        const users = await db.collection('users')
            .find(
                { _id: { $in: userIds } },
                { projection: { role: 1 } },
            )
            .toArray()

        if (
            users.length !== doctors.length ||
            users.some(user => user.role !== 'doctor')
        ) {
            throw new Error(
                'Doctor account links are incomplete or invalid. Migration stopped.',
            )
        }

        const futureActive = await db.collection('appointments')
            .countDocuments({
                status: { $in: ['pending', 'confirmed', 'checked_in'] },
                startAt: { $gt: new Date() },
            })

        if (futureActive > 0) {
            throw new Error(
                `${futureActive} future active appointments found. Migration stopped.`,
            )
        }

        const conflicts = await db.collection('appointments').aggregate([
            {
                $match: {
                    status: { $in: ['pending', 'confirmed', 'checked_in'] },
                },
            },
            {
                $group: {
                    _id: {
                        doctorId: '$doctorId',
                        startAt: '$startAt',
                    },
                    count: { $sum: 1 },
                },
            },
            { $match: { count: { $gt: 1 } } },
        ]).toArray()

        if (conflicts.length > 0) {
            throw new Error(
                'Duplicate active appointments found. Migration stopped.',
            )
        }

        const updates = doctors.map((doctor, index) => {
            const name = DEMO_NAMES[index % DEMO_NAMES.length]
            const availability = migrateAvailability(doctor, index)

            if (
                availability.some(block =>
                    !Number.isInteger(block.dayOfWeek) ||
                    block.dayOfWeek < 0 ||
                    block.dayOfWeek > 6 ||
                    !/^([01]\d|2[0-3]):[0-5]\d$/.test(block.startTime || '') ||
                    !/^([01]\d|2[0-3]):[0-5]\d$/.test(block.endTime || '')
                )
            ) {
                throw new Error(
                    `Invalid availability for ${doctor.fullName}. Migration stopped.`,
                )
            }

            return {
                updateOne: {
                    filter: { _id: doctor._id },
                    update: {
                        $set: {
                            fullName: `Dr. ${name}`,
                            verificationStatus:
                                index === 19 ? 'pending' : 'verified',
                            availability,
                            updatedAt: new Date(),
                        },
                    },
                },
            }
        })

        console.log('\n=== DOCTOR MIGRATION PREVIEW ===')

        updates.forEach((operation, index) => {
            const update = operation.updateOne.update.$set

            console.log({
                oldName: doctors[index].fullName,
                newName: update.fullName,
                verificationStatus: update.verificationStatus,
                availabilityBlocks: update.availability.length,
            })
        })

        console.log('\n=== PRESERVATION CHECKS ===')
        console.log('Database:', db.databaseName)
        console.log('Doctors:', doctors.length)
        console.log('Linked doctor accounts:', users.length)
        console.log('Future active appointments:', futureActive)
        console.log('Duplicate active booking conflicts:', conflicts.length)
        console.log('Backup:', backupPath)

        if (!apply) {
            console.log('\nDRY RUN ONLY. No database records were changed.')
            console.log('Review the preview before applying the migration.')
            return
        }

        const result = await db.collection('doctors').bulkWrite(
            updates,
            { ordered: true },
        )

        console.log('\n=== MIGRATION COMPLETE ===')
        console.log('Doctors matched:', result.matchedCount)
        console.log('Doctors modified:', result.modifiedCount)
        console.log('Other collections: untouched')
    } finally {
        await disconnectDatabase()
    }
}

main().catch(error => {
    console.error('\nMigration failed:', error.message)
    process.exitCode = 1
})
