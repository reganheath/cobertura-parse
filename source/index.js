"use strict";

var fs = require( "fs" );
var path = require('path');
var parseString = require( "xml2js" ).parseString;

var parse = {};

var classesFromPackages = function ( packages )
{
    var classes = [];

    packages.forEach( function ( packages )
    {
        packages.package.forEach( function ( pack )
        {
            pack.classes.forEach( function( c )
            {
                classes = classes.concat( c.class );
            } );
        } );
    } );

    return classes;
};

var extractLcovStyleBranches = function ( c ) {
    var branches = [];

    if ( c.lines && c.lines[0].line )
    {
        c.lines[0].line.forEach( function ( l )
        {
            if ( l.$.branch == 'true' )
            {
                var branchStats = l.$['condition-coverage'].match( /\d+/g );
                var coveredBranches = Number( branchStats[1] );
                var totalBranches = Number( branchStats[2] );
                var leftBranches = totalBranches - coveredBranches;

                var branchNumber = 0;

                for ( let i = 0; i < leftBranches; i++ )
                {
                    branches.push( {
                        line: Number( l.$.number ),
                        branch: branchNumber,
                        taken: 0
                    } );
                    branchNumber++;
                }

                for ( let i = 0; i < coveredBranches; i++ )
                {
                    branches.push( {
                        line: Number( l.$.number ),
                        branch: branchNumber,
                        taken: 1
                    } );
                    branchNumber++;
                }
            }
        });
    }

    return branches;
}

var unpackage = function ( coverage, absPath )
{
    var packages = coverage.packages;
    var source = coverage.sources[ 0 ].source[ 0 ];

    var classes = classesFromPackages( packages );
    return classes.map( function ( c )
    {
        var branches = extractLcovStyleBranches( c );
        var classCov = {
            title: c.$.name,
            file: absPath ? path.join( source, c.$.filename ) : c.$.filename,
            functions: {
                found: c.methods && c.methods[ 0 ].method ? c.methods[ 0 ].method.length : 0,
                hit: 0,
                details: !c.methods || !c.methods[ 0 ].method ? [] : c.methods[ 0 ].method.map( function ( m )
                {
                    return {
                        name: m.$.name,
                        line: m.lines && m.lines[ 0 ] && m.lines[ 0 ].line ? Number( m.lines[ 0 ].line[ 0 ].$.number ):0,
                        hit: m.lines && m.lines[ 0 ] && m.lines[ 0 ].line ? Number( m.lines[ 0 ].line[ 0 ].$.hits ):0
                    };
                } )
            },
            lines: {
                found: c.lines && c.lines[ 0 ].line ? c.lines[ 0 ].line.length : 0,
                hit: 0,
                details: !c.lines || !c.lines[ 0 ].line ? [] : c.lines[ 0 ].line.map( function ( l )
                {
                    return {
                        line: Number( l.$.number ),
                        hit: Number( l.$.hits )
                    };
                } )
            },
            branches: {
                found: branches.length,
                hit: branches.filter( function ( br ) { return br.taken > 0; } ).length,
                details: branches
            }
        };

        classCov.functions.hit = classCov.functions.details.reduce( function ( acc, val )
        {
            return acc + ( val.hit > 0 ? 1 : 0 );
        }, 0 );

        classCov.lines.hit = classCov.lines.details.reduce( function ( acc, val )
        {
            return acc + ( val.hit > 0 ? 1 : 0 );
        }, 0 );

        return classCov;
    } );
};

parse.parseContent = function ( xml, cb, absPath )
{
    parseString( xml, function ( err, parseResult )
    {
        if( err )
        {
            return cb( err );
        }

        var result = unpackage( parseResult.coverage, absPath );

        cb( err, result );
    } );
};

parse.parseFile = function( file, cb, absPath )
{
    absPath = absPath === undefined ? true : absPath;

    fs.readFile( file, "utf8", function ( err, content )
    {
        if( err )
        {
            return cb( err );
        }

        parse.parseContent( content, cb, absPath );
    } );
};

module.exports = parse;
